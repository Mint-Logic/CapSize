#include <napi.h>
#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wincodec.h>
#include <inspectable.h> 

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.System.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>

#include <atomic>
#include <vector>
#include <stdexcept>
#include <algorithm>

#pragma comment(lib, "windowsapp")
#pragma comment(lib, "dwmapi")
#pragma comment(lib, "d3d11")
#pragma comment(lib, "dxgi")
#pragma comment(lib, "windowscodecs")

// --- RESTORED INTERFACE DEFINITIONS (The missing link!) ---
MIDL_INTERFACE("A9B3D012-3DF2-4EE3-B8D1-8695F457D3C1")
IDirect3DDxgiInterfaceAccess : public IUnknown
{
public:
    virtual HRESULT STDMETHODCALLTYPE GetInterface(REFIID iid, void** p) = 0;
};

MIDL_INTERFACE("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356")
IGraphicsCaptureItemInterop : public IUnknown
{
public:
    virtual HRESULT STDMETHODCALLTYPE CreateForWindow(HWND window, REFIID riid, void **result) = 0;
    virtual HRESULT STDMETHODCALLTYPE CreateForMonitor(HMONITOR monitor, REFIID riid, void **result) = 0;
};

extern "C" HRESULT WINAPI CreateDirect3D11DeviceFromDXGIDevice(IDXGIDevice* dxgiDevice, IInspectable** graphicsDevice);

using namespace winrt;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;
using namespace winrt::Windows::Graphics::DirectX;

// --- D3D Context Helper ---
class D3DContext {
public:
    static D3DContext& Get() {
        static D3DContext instance;
        return instance;
    }
    ID3D11Device* Device() { return d3dDevice.get(); }
    ID3D11DeviceContext* Context() { return d3dContext.get(); }
    IDirect3DDevice WinRTDevice() { return winrtDevice; }
    IWICImagingFactory* WICFactory() { return wicFactory.get(); }
    bool IsValid() { return d3dDevice != nullptr && wicFactory != nullptr; }

private:
    D3DContext() { Init(); }
    void Init() {
        winrt::init_apartment(apartment_type::single_threaded);
        UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
        D3D_FEATURE_LEVEL levels[] = { D3D_FEATURE_LEVEL_11_0 };
        D3D_FEATURE_LEVEL level;
        ID3D11Device* dev = nullptr;
        ID3D11DeviceContext* ctx = nullptr;
        if (SUCCEEDED(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels, 1, D3D11_SDK_VERSION, &dev, &level, &ctx))) {
            d3dDevice.attach(dev);
            d3dContext.attach(ctx);
            com_ptr<IDXGIDevice> dxgi;
            if (SUCCEEDED(d3dDevice->QueryInterface(IID_PPV_ARGS(dxgi.put())))) {
                IInspectable* inspectable = nullptr;
                if (SUCCEEDED(CreateDirect3D11DeviceFromDXGIDevice(dxgi.get(), &inspectable))) {
                    winrt::copy_from_abi(winrtDevice, inspectable);
                    inspectable->Release();
                }
            }
        }
        CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(wicFactory.put()));
    }
    com_ptr<ID3D11Device> d3dDevice;
    com_ptr<ID3D11DeviceContext> d3dContext;
    com_ptr<IWICImagingFactory> wicFactory;
    IDirect3DDevice winrtDevice = nullptr;
};

// --- Main Capture Logic ---
class CapSize_WGCContext {
public:
    static std::vector<uint8_t> SnapshotMonitor(HMONITOR hMonitor) {
        auto& ctx = D3DContext::Get();
        if (!ctx.IsValid()) return {};

        auto activation = winrt::get_activation_factory<GraphicsCaptureItem>();
        auto interop = activation.as<IGraphicsCaptureItemInterop>();
        GraphicsCaptureItem item = { nullptr };
        
        // 1. Create Capture Item
        interop->CreateForMonitor(hMonitor, winrt::guid_of<GraphicsCaptureItem>(), winrt::put_abi(item));
        if (!item) return {};

        // 2. Start Capture Session
        auto size = item.Size();
        auto pool = Direct3D11CaptureFramePool::CreateFreeThreaded(ctx.WinRTDevice(), DirectXPixelFormat::B8G8R8A8UIntNormalized, 1, size);
        auto session = pool.CreateCaptureSession(item);
        session.IsCursorCaptureEnabled(false); 

        // --- THE FIX: KILL THE ORANGE PRIVACY BORDER ---
        try {
            session.IsBorderRequired(false);
        } catch (...) {
            // Fails silently on older Windows 10 machines that don't support hiding the border
        }
        // -----------------------------------------------

        HANDLE frameEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        com_ptr<ID3D11Texture2D> capturedTex = nullptr;
        bool gotFrame = false;

        auto token = pool.FrameArrived([&](auto& sender, auto&) {
            auto frame = sender.TryGetNextFrame();
            if (!frame) return;
            auto surface = frame.Surface();
            auto access = surface.as<IDirect3DDxgiInterfaceAccess>();
            ID3D11Texture2D* tex = nullptr;
            access->GetInterface(IID_PPV_ARGS(&tex));
            capturedTex.attach(tex);
            gotFrame = true;
            SetEvent(frameEvent);
        });

        session.StartCapture();

        // 3. Wait for Frame (Timeout 1.5s)
        DWORD start = GetTickCount();
        while (!gotFrame && (GetTickCount() - start < 1500)) {
            if (MsgWaitForMultipleObjects(1, &frameEvent, FALSE, 10, QS_ALLINPUT) == WAIT_OBJECT_0) break;
            MSG msg; 
            while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) DispatchMessage(&msg);
        }

        session.Close();
        pool.Close();
        CloseHandle(frameEvent);

        if (!capturedTex) return {};

        // 4. Copy to CPU (Staging)
        D3D11_TEXTURE2D_DESC desc;
        capturedTex->GetDesc(&desc);
        desc.Usage = D3D11_USAGE_STAGING;
        desc.BindFlags = 0;
        desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        desc.MiscFlags = 0;

        com_ptr<ID3D11Texture2D> stagingTex;
        ctx.Device()->CreateTexture2D(&desc, nullptr, stagingTex.put());
        ctx.Context()->CopyResource(stagingTex.get(), capturedTex.get());

        D3D11_MAPPED_SUBRESOURCE map;
        if (FAILED(ctx.Context()->Map(stagingTex.get(), 0, D3D11_MAP_READ, 0, &map))) return {};

        // 5. PROCESS PIXELS (The Fix!)
        std::vector<uint8_t> pixels(desc.Width * desc.Height * 4);
        uint8_t* dest = pixels.data();
        uint8_t* src = static_cast<uint8_t*>(map.pData);

        for (UINT row = 0; row < desc.Height; ++row) {
            uint8_t* dRow = dest + (row * desc.Width * 4);
            uint8_t* sRow = src + (row * map.RowPitch);
            memcpy(dRow, sRow, desc.Width * 4);

            // FORCE ALPHA TO 255 (OPAQUE)
            for (UINT x = 0; x < desc.Width; x++) {
                dRow[x * 4 + 3] = 255; 
            }
        }

        ctx.Context()->Unmap(stagingTex.get(), 0);

        // 6. Encode to PNG
        com_ptr<IStream> stream;
        CreateStreamOnHGlobal(nullptr, TRUE, stream.put());
        com_ptr<IWICBitmapEncoder> encoder;
        ctx.WICFactory()->CreateEncoder(GUID_ContainerFormatPng, nullptr, encoder.put());
        encoder->Initialize(stream.get(), WICBitmapEncoderNoCache);
        com_ptr<IWICBitmapFrameEncode> frame;
        encoder->CreateNewFrame(frame.put(), nullptr);
        frame->Initialize(nullptr);
        frame->SetSize(desc.Width, desc.Height);
        WICPixelFormatGUID format = GUID_WICPixelFormat32bppBGRA;
        frame->SetPixelFormat(&format);
        frame->WritePixels(desc.Height, desc.Width * 4, (UINT)pixels.size(), pixels.data());
        frame->Commit();
        encoder->Commit();

        LARGE_INTEGER seek = {0};
        ULARGE_INTEGER sSize;
        stream->Seek(seek, STREAM_SEEK_END, &sSize);
        stream->Seek(seek, STREAM_SEEK_SET, nullptr);
        std::vector<uint8_t> pngData(sSize.QuadPart);
        ULONG bytesRead;
        stream->Read(pngData.data(), (ULONG)sSize.QuadPart, &bytesRead);

        return pngData;
    }
};

Napi::Value CaptureScreenWrapper(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return env.Null();

    POINT pt;
    pt.x = info[0].As<Napi::Number>().Int32Value();
    pt.y = info[1].As<Napi::Number>().Int32Value();
    
    HMONITOR hMon = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
    if (!hMon) return env.Null();

    try {
        auto png = CapSize_WGCContext::SnapshotMonitor(hMon);
        if (png.empty()) return env.Null();
        return Napi::Buffer<uint8_t>::Copy(env, png.data(), png.size());
    } catch (...) {
        return env.Null();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "captureScreen"), Napi::Function::New(env, CaptureScreenWrapper));
    return exports;
}

NODE_API_MODULE(wgc_capture, Init)