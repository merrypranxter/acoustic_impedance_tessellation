// =============================================================================
// b_mode_shadertoy.glsl — Self-contained B-mode ultrasound, pasteable straight
// into https://www.shadertoy.com (no #include, uses Shadertoy's built-in
// iResolution/iTime/iMouse). A condensed standalone of the repo's modular
// pipeline so you can poke at it with zero setup.
//
// Drag the mouse left/right to move the transmit focus depth.
// =============================================================================

#define PI 3.14159265

float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x),
               mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=0.5;} return v; }
float sdCircle(vec2 p,vec2 c,float r){ return length(p-c)-r; }

// Impedance phantom (MRayl): fat over liver, a fluid cyst, a hard rib.
float impedance(vec2 uv){
    float z = mix(1.33, 1.65, smoothstep(0.05,0.25,uv.y));      // fat -> liver
    z = mix(z, 1.48, smoothstep(0.01,-0.01, sdCircle(uv,vec2(0.62,0.55),0.10))); // cyst
    z = mix(z, 7.75, smoothstep(0.01,-0.01, sdCircle(uv,vec2(0.22,0.18),0.05))); // rib
    z += (fbm(uv*180.0)-0.5)*0.08;                              // scatterers
    return max(z, 0.0004);
}

float reflectivity(vec2 uv){
    vec2 e = vec2(1.5/iResolution.y, 0.0);
    float dz = length(vec2(impedance(uv+e.xy)-impedance(uv-e.xy),
                           impedance(uv+e.yx)-impedance(uv-e.yx)))/(2.0*e.x);
    float z = impedance(uv);
    return (dz*dz)/((2.0*z+dz)*(2.0*z+dz));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord/iResolution.xy;

    float freq = 6.0;                              // MHz
    float focus = iMouse.z>0.0 ? iMouse.x/iResolution.x : 0.45;

    // Attenuation (0.5 dB/cm/MHz over ~12 cm, round trip) + TGC.
    float cm = uv.y*12.0;
    float att = pow(10.0, -(0.5*freq*cm*2.0)/20.0);
    float tgc = mix(1.0, 1.0/max(att,1e-3), 0.6);

    // Beam: brightest near the focal depth, softening above and below it
    // (this single-line version beamforms each column on its own axis).
    float beam = 1.0 - 0.25*abs(uv.y-focus);       // depth-of-focus falloff

    float echo = reflectivity(uv)*att*tgc*beam*1.6;

    // Log compression to a 50 dB dynamic range.
    float dB = 20.0*log(echo+1e-4)/log(10.0);
    float b = clamp((dB+50.0)/50.0, 0.0, 1.0);

    vec3 col = vec3(b)*vec3(1.04,1.0,0.94);
    col *= smoothstep(1.15,0.35,length(uv-0.5));   // vignette
    col += vec3(0.25)*smoothstep(0.006,0.0,uv.y);  // skin line
    fragColor = vec4(col,1.0);
}
