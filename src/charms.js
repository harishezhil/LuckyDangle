// Each charm is a PNG. "height" is how tall it appears on screen (px).
//
// Optional settings on a charm:
//   layers      extra pictures drawn on top of the body. Give a layer a "name" and "opacity: 0" so a
//               reaction can show it, or "keyframes" so it loops on its own.
//   react       what happens when you click or drag it: "bell", "blink" or "glow"
//   rope        the string style: "ink" (plain black line), "web" (inked silk thread), or leave out for gold
//   ropeLength  how long the string hangs (px)
//   ropeStub    for "ink" strings: how wide the picture's own string is, in the picture's own pixels.
//               The app turns this into the right thickness for whatever height you choose.
//   ropeScale   for "web" strings: 1 = drawn for a 240px charm, so 0.625 suits a 150px charm
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
    height: 150,
  },
  {
    name: "Lucky cat",
    src: "charms/cat_body.png",
    layers: [{
      src: "charms/cat_arm.png",
      origin: [19, 70],       // the shoulder, as % of the picture
      duration: 1400,         // ms for one swing, forward or back
      keyframes: [
        { transform: "perspective(160px) rotateX(-34deg)" },  // paw comes toward you
        { transform: "perspective(160px) rotateX(34deg)" },   // paw pulls back
      ],
    }],
    height: 150,
  },
  { name: "Bell", src: "charms/bell.png", height: 150, react: "bell" },
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
    ropeScale: 0.625,
    ropeLength: 320,
    height: 150,
  },
  { name: "Spidey (blue)", src: "charms/spidey_blue.png",  height: 150, rope: "ink", ropeStub: 32 },
  { name: "Miles",         src: "charms/spidey_miles.png", height: 150, rope: "ink", ropeStub: 9.1 },
];