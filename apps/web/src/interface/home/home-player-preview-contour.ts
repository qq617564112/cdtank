/** Portrait outline relative to the original 150 × 100 model region. */
const lowerAndRightContour = `L155.5 7.5Q155 13.5 153.5 16.5
  L153.5 80.5Q153.5 89 155.5 97.5Q154.5 103 150.5 105.5
  Q147 107 143.5 106.5L120 106.5Q103 105 87 105.5
  Q60 104 35 104.5Q22 106 11 106.5`;

export const HOME_PLAYER_PREVIEW_CONTOUR = `M-6 2Q-7 -1 -3 -3
  L9 -4L58 -3L102 -4L148 -3Q156 -5 155.5 2
  ${lowerAndRightContour}L-5 106.5Q-8 105 -7 101L-6 55L-5 16Z`;

/** Keep the canvas open above and to the left of the portrait. */
export const HOME_PLAYER_MODEL_CLIP = `M-112.5 -75L155.5 -75
  ${lowerAndRightContour}L-112.5 106.5Z`.replace(/\s+/g, ' ');
