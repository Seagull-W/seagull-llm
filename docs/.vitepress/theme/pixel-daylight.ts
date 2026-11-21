// The calibrated daylight inks occupy different quarters of each sRGB channel.
// This lets the same artwork use an exact four-color lookup in either appearance.
export const pixelDaylightMatrix = [
  0.669152176, -0.679108028, -1.338792684, 0, 1.3580969,
  -0.19327507, -0.126798811, -0.733040814, 0, 1.182104348,
  -0.234658978, -1.178711596, 0.765784305, 0, 0.936860505,
  0, 0, 0, 1, 0,
].join(' ')

// Keep the order of the original ink, shade, accent and ground when recoloring.
const calibratedInks = [0x26364a, 0x698f82, 0xb57c3b, 0xece9df]
function channelTables(colors: number[]) {
  return [16, 8, 0].map(shift => {
    const table = new Array<number>(4)
    calibratedInks.forEach((source, index) => {
      const band = ((source >> shift) & 255) >> 6
      table[band] = ((colors[index] >> shift) & 255) / 255
    })
    return table.join(' ')
  })
}

export const pixelArtPalettes = {
  'pixel-daylight': channelTables([0x213f69, 0x6388ad, 0xa97036, 0xeaf1f9]),
  'pixel-night': channelTables([0xe6f1ff, 0x729bc8, 0xe0af77, 0x1b304a]),
}
