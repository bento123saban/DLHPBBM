var fx = {
    canvas: function() {
        return {
            draw: function() { return this; },
            update: function() {},
            replace: function() {},
            texture: function() { return {}; },
            brightnessContrast: function() { return this; },
            hueSaturation: function() { return this; },
            denoise: function() { return this; },
            unsharpMask: function() { return this; },
            perspective: function() { return this; },
            bulgePinch: function() { return this; },
            triangleBlur: function() { return this; },
            ink: function() { return this; }
        };
    }
};