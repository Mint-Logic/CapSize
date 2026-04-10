// math.js - Pure geometry helpers

export const MathUtils = {
    // Distance between a point (p) and a line segment (v to w)
    pointToLineDist: (p, v, w) => {
        const l2 = (Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2));
        if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    },

    // Distance between a point and a Quadratic Bezier Curve
    pointToCurveDist: (p, x1, y1, cp, x2, y2) => {
        // Sample points along the curve to find closest distance (Efficient approximation)
        let minD = Infinity;
        for (let t = 0; t <= 1; t += 0.05) {
            const lx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cp.x + t * t * x2;
            const ly = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cp.y + t * t * y2;
            const d = Math.hypot(p.x - lx, p.y - ly);
            if (d < minD) minD = d;
        }
        return minD;
    },

    // Calculate the center point of any shape
    getShapeCenter: (s) => {
        if (['line', 'arrow'].includes(s.type)) {
            return { x: (s.x + s.ex) / 2, y: (s.y + s.ey) / 2 };
        }
        return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    },

    // Calculate the bounding box of a shape
    getBoundingBox: (s) => {
        if (s.points) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            s.points.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
            return {
                x: minX + (s.x || 0),
                y: minY + (s.y || 0),
                w: s.w || (maxX - minX),
                h: s.h || (maxY - minY)
            };
        }
        return { x: s.x, y: s.y, w: s.w, h: s.h };
    }
};