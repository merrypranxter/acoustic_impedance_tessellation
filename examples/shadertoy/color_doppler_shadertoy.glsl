// =============================================================================
// color_doppler_shadertoy.glsl — Self-contained color-flow Doppler, pasteable
// into https://www.shadertoy.com. Grayscale anatomy with a pulsatile vessel;
// flow toward the probe is red, away is blue (BART: Blue Away, Red Toward).
// =============================================================================

#define PI 3.14159265

float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x),
               mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=0.5;} return v; }

// A vessel running diagonally across the field.
float vesselSDF(vec2 p){
    vec2 a=vec2(0.1,0.40), b=vec2(0.9,0.60); vec2 pa=p-a, ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return length(pa-ba*h)-0.06;
}

float impedance(vec2 uv){
    float z = mix(1.33,1.65, smoothstep(0.05,0.3,uv.y));
    z = mix(z, 1.66, smoothstep(0.005,-0.005, vesselSDF(uv)));  // blood
    z += (fbm(uv*170.0)-0.5)*0.07;
    return max(z,0.0004);
}
float reflectivity(vec2 uv){
    vec2 e=vec2(1.5/iResolution.y,0.0);
    float dz=length(vec2(impedance(uv+e.xy)-impedance(uv-e.xy),
                         impedance(uv+e.yx)-impedance(uv-e.yx)))/(2.0*e.x);
    float z=impedance(uv);
    return (dz*dz)/((2.0*z+dz)*(2.0*z+dz));
}

float flow(vec2 uv){
    if(vesselSDF(uv) > 0.0) return 0.0;
    float pulse = max(sin(iTime*1.1*6.2831),0.0); pulse=pulse*pulse*0.8+0.2;
    // Parabolic laminar profile across the lumen, direction set by flow vector.
    float prof = 1.0 - pow(vesselSDF(uv)/0.06 + 1.0, 2.0);
    float dir = sign(0.5 - uv.x);     // left half toward probe, right away
    return clamp(prof,0.0,1.0)*pulse*dir;
}
vec3 dopplerColor(float v){
    float m=clamp(abs(v),0.0,1.0);
    return v>=0.0 ? mix(vec3(0.5,0,0),vec3(1,1,0),m)
                  : mix(vec3(0,0,0.5),vec3(0,1,1),m);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord/iResolution.xy;
    float cm=uv.y*12.0;
    float att=pow(10.0,-(0.5*6.0*cm*2.0)/20.0);
    float tgc=mix(1.0,1.0/max(att,1e-3),0.6);
    float echo=reflectivity(uv)*att*tgc*1.6;
    float b=clamp((20.0*log(echo+1e-4)/log(10.0)+50.0)/50.0,0.0,1.0);
    vec3 col=vec3(b)*vec3(1.04,1.0,0.94);

    float v=flow(uv);
    if(abs(v)>0.02) col=mix(col,dopplerColor(v),clamp(abs(v)*1.4,0.0,0.85));
    fragColor=vec4(col,1.0);
}
