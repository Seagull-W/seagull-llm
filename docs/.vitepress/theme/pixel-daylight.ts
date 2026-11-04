// Affine sRGB palette mapping for the four-color Pixel Voyage assets.
// Midnight -> warm paper; cream -> ink; green -> sage; apricot -> ochre.
// Alpha stays unchanged. This is theme rendering, not a destructive image edit.
export const pixelDaylightMatrix = [
  0.669152176, -0.679108028, -1.338792684, 0, 1.3580969,
  -0.19327507, -0.126798811, -0.733040814, 0, 1.182104348,
  -0.234658978, -1.178711596, 0.765784305, 0, 0.936860505,
  0, 0, 0, 1, 0,
].join(' ')
