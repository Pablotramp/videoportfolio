export default function getSpotImageUrl(spot) {
  return typeof spot?.imgUrl === 'string' ? spot.imgUrl.trim() : ''
}
