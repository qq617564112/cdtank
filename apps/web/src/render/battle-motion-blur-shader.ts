/** Babylon's linear velocity is previous UV minus current UV; tag zero stays clear. */
export const battleMotionBlurFragment = `
varying vUV: vec2f;
var textureSamplerSampler: sampler;
var textureSampler: texture_2d<f32>;
var velocitySamplerSampler: sampler;
var velocitySampler: texture_2d<f32>;
var playerMaskSampler: texture_2d<u32>;
uniform motionStrength: f32;
uniform screenSize: vec2f;

// Match nearest-neighbor sampling with clamp-to-edge, including UV equal to one.
fn playerMask(uv: vec2f, size: vec2i) -> u32 {
  let pixel = clamp(vec2i(floor(uv * vec2f(size))), vec2i(0), size - vec2i(1));
  return textureLoad(playerMaskSampler, pixel, 0).r;
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let maskSize = vec2i(textureDimensions(playerMaskSampler));
  let eligible = playerMask(input.vUV, maskSize);
  if (eligible == 0u || uniforms.motionStrength == 0.0) {
    fragmentOutputs.color = textureSampleLevel(textureSampler, textureSamplerSampler, input.vUV, 0.0);
    return fragmentOutputs;
  }
  let velocity = textureSampleLevel(velocitySampler, velocitySamplerSampler, input.vUV, 0.0).rg
    * uniforms.motionStrength;
  let samples = i32(clamp(ceil(length(velocity * uniforms.screenSize)), 1.0, 4.0));
  if (samples == 1) {
    fragmentOutputs.color = textureSampleLevel(textureSampler, textureSamplerSampler, input.vUV, 0.0);
    return fragmentOutputs;
  }
  var result = vec4f(0.0);
  var count = 0.0;
  for (var i = 0; i < 4; i++) {
    if (i >= samples) { break; }
    let offset = velocity * (f32(i) / f32(samples - 1) - 0.5);
    let uv = clamp(input.vUV + offset, vec2f(0.0), vec2f(1.0));
    if (playerMask(uv, maskSize) == 0u) { continue; }
    result += textureSampleLevel(textureSampler, textureSamplerSampler, uv, 0.0);
    count += 1.0;
  }
  if (count == 0.0) {
    result = textureSampleLevel(textureSampler, textureSamplerSampler, input.vUV, 0.0);
    count = 1.0;
  }
  fragmentOutputs.color = result / count;
  return fragmentOutputs;
}`;
