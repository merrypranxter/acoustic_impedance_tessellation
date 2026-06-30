// =============================================================================
// core/wave_equation.glsl
// Pulse propagation and attenuation. We don't time-step a full FDTD grid in the
// fragment shader (that needs ping-pong buffers — see examples/python for the
// real solver). Instead we use the analytic pulse-echo model: a short Gaussian
// pulse travels down, attenuates, and the echo strength at each depth is read
// from the impedance map. This is what real B-mode reconstruction assumes.
//
//   PDE being approximated:  d2p/dt2 = c^2 * laplacian(p) - alpha * dp/dt
//
// Requires: common/uniforms.glsl, core/impedance_map.glsl
// =============================================================================

#ifndef WAVE_EQUATION_GLSL
#define WAVE_EQUATION_GLSL

// Frequency-dependent attenuation. Soft tissue ~0.5 dB/cm/MHz; we map the image
// height to ~12 cm of penetration. Returns a linear [0,1] amplitude factor.
float attenuation(float depth, float freqMHz) {
    const float CM_PER_SCREEN = 12.0;
    const float DB_PER_CM_PER_MHZ = 0.5;
    float cm = depth * CM_PER_SCREEN;
    float dB = DB_PER_CM_PER_MHZ * freqMHz * cm * 2.0; // *2 = down-and-back
    return pow(10.0, -dB / 20.0);
}

// Time-gain compensation: brighten deeper echoes to undo attenuation. uTGC
// scales how aggressively we compensate (0 = off, 1 = full reciprocal).
float timeGainCompensation(float depth) {
    float comp = 1.0 / max(attenuation(depth, uProbeFrequency), 1e-3);
    return mix(1.0, comp, uTGC);
}

// A short transmitted pulse envelope centered on the current "live" depth.
// The pulse sweeps from skin to deep tissue once per `period` seconds, giving
// modes the option of an animated scan line.
float pulseEnvelope(float depth, float t, float period) {
    float front = fract(t / period);          // 0..1 sweeping wavefront depth
    float d = depth - front;
    float width = 0.5 / uProbeFrequency;       // higher freq => shorter pulse
    return exp(-(d * d) / (width * width)) * step(0.0, front - depth + width);
}

// Oscillating carrier inside the pulse — the actual ultrasound ping.
float carrier(float depth, float t) {
    float cycles = uProbeFrequency * 6.0;      // visual cycles across the screen
    return sin(TWO_PI * (cycles * depth - t * 3.0));
}

// Echo amplitude returned from a point: reflectivity, attenuated both ways,
// TGC-compensated, gain-scaled. This is the heart of the B-mode signal.
float echoAmplitude(vec2 uv) {
    float r   = reflectivity(uv);
    float att = attenuation(uv.y, uProbeFrequency);
    float tgc = timeGainCompensation(uv.y);
    return r * att * tgc * uGain;
}

// Logarithmic compression to the display dynamic range. Real scanners squeeze
// a huge echo range into ~8 bits this way; it's why ultrasound looks the way
// it does. Input: linear echo >= 0. Output: [0,1] brightness.
float logCompress(float echo) {
    float dr = max(uDynamicRange, 1.0);
    float dB = 20.0 * log(echo + 1e-4) / log(10.0);
    return clamp((dB + dr) / dr, 0.0, 1.0);
}

#endif // WAVE_EQUATION_GLSL
