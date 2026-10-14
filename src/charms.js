// Each charm is a PNG. "height" is how tall it appears on screen (px).
// "layers" (optional) are extra images drawn on top of the body. A layer can have a "name" and
//   start invisible (opacity: 0) so a reaction can show it, or it can have "keyframes" that loop.
// "react" (optional) is what happens when you click or drag the charm: "bell", "blink" or "glow".
// "rope" and "ropeLength" (optional) set the string style and how long it hangs (px).
const CHARMS = [
  { name: "Evil eye", src: "charms/eye.png", height: 150 },
  {
    name: "Hamsa",
    src: "charms/hamsa.png",
    layers: [{ name: "blink", src: "charms/hamsa_closed.png", opacity: 0 }],
    react: "blink",
    height: 150,
  },
  { name: "Chili and lemon", src: "charms/chili.png", height: 150 },
  {
    name: "Oni mask",
    src: "charms/oni.png",
    layers: [{ name: "glow", src: "charms/oni_glow.png", opacity: 0 }],
    react: "glow",
    height: 170,
  },
  {
    name: "Lucky cat",
    src: "charms/cat_body.png",
    layers: [{
      src: "charms/cat_arm.png",
      origin: [19, 70],       // the shoulder, as % of the image
      duration: 1400,         // ms for one swing, forward or back
      keyframes: [
        { transform: "perspective(260px) rotateX(-34deg)" },  // paw comes toward you
        { transform: "perspective(260px) rotateX(34deg)" },   // paw pulls back
      ],
    }],
    height: 150,
  },
  { name: "Bell", src: "charms/bell.png", height: 150, react: "bell" },
  { name: "Spider-Man (cartoon)", src: "charms/spider_cartoon.png", height: 180, rope: "toon" },
  {
    name: "Spidey (chibi)",
    src: "charms/spidey_body.png",
    layers: [{
      src: "charms/spidey_sense.png",
      origin: [55, 59],
      duration: 900,
      keyframes: [
        { opacity: 1,   transform: "scale(1)" },
        { opacity: 0.4, transform: "scale(1.1)" },
      ],
    }],
    rope: "web",
    ropeLength: 250,
    height: 150,
  },
];