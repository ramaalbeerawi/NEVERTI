// =========================================================
// tools/product-finishes.mjs — what each Neverti product REALLY is
//
// One row per product line. Every decision uses three checks
// (FINAL_UPDATE_PROMPT.md section 2.2):
//   1. the name and the description, in English and in Arabic
//   2. the swatch photo (flat and opaque = matte, thin = sheer, highlights = gloss,
//      sparkles = shimmer, thick and creamy = cream)
//   3. both must agree. If not, confidence is "medium" or "low" and the row is listed
//      in PRODUCT_MATERIAL_MAP.md under "Please review".
//
// To change a product: edit its row here, then run
//     node tools/build_products.mjs
// The try-on reads the material from this data, never from the color.
//
// finish   lips: matte | cream | tint | gloss | shimmer-gloss | oil | balm | liner
//          blush: powder | powder-cream | cream | liquid | glowy
//          face:  matte-soft | radiant | dewy | serum | stick | corrector | pressed | loose | contour | pearl
//          eyes:  kohl | glossy-liquid | matte-liquid | gel | mascara
//          brows: pomade | tinted | pen | wax
// texture  liquid | cream | powder | stick | gel | pencil | pot | compact
// coverage sheer | medium | full        sheen none | satin | glossy | wet
// shimmer  none | fine | pearl | glitter
// =========================================================

const row = (finish, texture, coverage, sheen, shimmer, material, confidence, evidence) =>
  ({ finish, texture, coverage, sheen, shimmer, material, confidence, evidence });

export const FINISHES = {
  // ---------------- LIPS ----------------
  "matte-couture-liquid-lipstick": row("matte", "liquid", "full", "none", "none", "matte-liquid-lipstick", "high",
    "Name says Matte Liquid Lipstick; description: \"elegant matte finish\" (AR: مطفي); swatch is flat and opaque."),
  "matt-idole-lipstick": row("matte", "stick", "full", "none", "none", "matte-lipstick", "high",
    "Name says Matt; description: \"soft, velvety matte\" (AR: مطفي، مخملي); swatch is thick, flat and opaque."),
  "matt-mallow-lipstick": row("matte", "cream", "full", "satin", "none", "matte-lipstick", "medium",
    "Name says Matt; description: creamy texture, full coverage; swatch is creamy with a soft sheen. A creamy matte."),
  "limitless-kiss-lipstick": row("cream", "cream", "full", "satin", "none", "satin-lipstick", "high",
    "Description: \"waterproof creamy lipstick\" (AR: روج كريمي); swatch is creamy with a soft satin sheen."),
  "let-lip-rejoice-lipstick": row("cream", "cream", "full", "satin", "none", "satin-lipstick", "medium",
    "Description: \"creamy formula… luminous matte effect\" (AR: تأثير لومي غير لامع = luminous, not shiny); swatch is creamy with a soft glow. Between matte and satin."),
  "kiss-adore-shiny-lipstick": row("cream", "stick", "full", "glossy", "none", "shine-lipstick", "high",
    "Name says Shiny; description: \"creamy lipstick… radiant finish\" (AR: كريمي، مشرق); swatch is glossy cream."),
  "soft-tint-lipgloss": row("tint", "liquid", "medium", "satin", "none", "lip-tint", "medium",
    "Name says Tint; description: water-based, \"natural, vibrant and glossy look\"; swatch is a flat satin stain with little shine. Stain with a light sheen."),
  "creamy-lip-balm": row("balm", "stick", "medium", "glossy", "none", "tinted-balm", "medium",
    "Description: \"ultra-creamy… radiant shine… highly pigmented\" (AR: كريمي، لمعان); swatch is a creamy tinted balm."),
  "3d-plumping-intense-lipgloss": row("gloss", "liquid", "sheer", "wet", "none", "plumping-gloss", "high",
    "Name says Lipgloss; description: plumping gloss, \"fuller, shinier look… use alone for a sheer…\" (AR: ملمع); swatch shows strong wet highlights. Gloss Me is clear."),
  "be-allure-up-shine-lipgloss": row("shimmer-gloss", "liquid", "medium", "glossy", "fine", "shimmer-gloss", "high",
    "Name says Shine Lipgloss; description: \"eye-catching shine… glossy finish\"; swatch clearly shows fine pearl sparkles."),
  "lip-cocktail": row("oil", "liquid", "sheer", "wet", "none", "lip-oil", "high",
    "Description: \"A lip oil… healthy shine\" (AR: ليب أويل); swatch is a transparent tinted oil."),
  "kiss-couture-waterproof-liner": row("liner", "pencil", "full", "none", "none", "lip-liner", "high",
    "Description: lip liner pencil, soft creamy formula (AR: قلم تحديد الشفاه)."),
  "liptrace-liner": row("liner", "pencil", "full", "none", "none", "lip-liner", "high",
    "Description: Lip Trace Liner, defines or fills the lips (AR: محدد الشفاه)."),

  // ---------------- CHEEKS ----------------
  "cream-lush-blush": row("cream", "pot", "medium", "satin", "none", "cream-blush", "high",
    "Name and description: Cream Blush, \"creamy formula… natural radiant glow… velvety finish\" (AR: بلاشر كريمي); swatch is a soft cream."),
  "liquid-blush": row("liquid", "liquid", "medium", "satin", "none", "liquid-blush", "medium",
    "Description: \"Highlighter liquid blush… natural, radiant flush\" (AR: بلاشر سائل); buildable, blendable pigments. It calls itself a highlighter liquid blush, so it may look a little more luminous than a plain stain."),
  "creamy-dimension-waterproof-blush": row("glowy", "compact", "medium", "glossy", "none", "glowy-blush", "medium",
    "Description: \"velvety creamy formula… natural and luminous finish… fresh and dewy glow\" (AR: توهج). A creamy compact with a luminous finish, so a glowy blush, not a powder one."),
  "contour-balm-stick": row("contour", "stick", "medium", "none", "none", "contour", "high",
    "Name says Contour Stick; description: practical stick, easy blending (AR: كونتور ستيك)."),
  "creamy-dimension-contrast-contour": row("contour", "compact", "medium", "none", "none", "contour", "high",
    "Description: \"lightweight creamy texture… define cheekbones, temples, chin and nose through shading\" (AR: كونتور)."),
  "sculpt-shaping-stick-contour": row("contour", "stick", "medium", "none", "none", "contour", "high",
    "Description: \"contour stick… creamy stick formula\" (AR: كونتور، عصا كريمية)."),
  "liquid-highlighter": row("pearl", "liquid", "sheer", "glossy", "pearl", "highlighter", "high",
    "Description: \"liquid face highlighter… natural radiance and balanced glow\" (AR: هايلايتر سائل)."),
  "waterproof-highlighter": row("pearl", "cream", "sheer", "glossy", "pearl", "highlighter", "medium",
    "Description: \"lightweight, creamy formula… accentuate cheekbones, temples, chin and nose\". A creamy highlighter."),

  // ---------------- FACE ----------------
  "soft-focus-feature-foundation": row("matte-soft", "liquid", "medium", "none", "none", "foundation-soft-matte", "medium",
    "Name says Soft Focus; description: even, natural-looking complexion with a soft touch. A soft-matte finish."),
  "natural-matte-flawless-foundation": row("matte-soft", "liquid", "medium", "none", "none", "foundation-soft-matte", "high",
    "Name and description: \"Natural Matte Foundation\", even natural coverage (AR: كريم الأساس الطبيعي المطفي)."),
  "moisturizing-natural-glow-weightless-foundation": row("radiant", "liquid", "medium", "satin", "none", "foundation-glow", "high",
    "Name says Natural Glow; description: \"enhances skin vitality and radiance\"."),
  "tinted-gel-cream-bb": row("dewy", "gel", "medium", "satin", "none", "bb-cream", "high",
    "Name says Tinted Gel Cream BB; description: \"medium coverage… luminous finish\" (AR: كريم BB)."),
  "skin-smooth-serum-concealer": row("serum", "liquid", "medium", "satin", "none", "concealer-serum", "high",
    "Name and description: Serum Concealer, \"smooth, fluid formula… soft finish… buildable coverage\" (AR: كونسيلر سيروم)."),
  "radiant-creamy-cover-concealer": row("serum", "liquid", "medium", "satin", "none", "concealer-serum", "medium",
    "Name says Radiant Creamy Cover; description: \"flawless coverage for dark circles… light, natural finish… more radiant\"."),
  "pure-perfection-concealer-pen": row("stick", "stick", "full", "none", "none", "concealer-stick", "high",
    "Name says Concealer Pen; description: pen design for precise application on small areas (AR: كونسيلر القلم)."),
  "radiant-creamy-corrector": row("corrector", "liquid", "medium", "satin", "none", "color-corrector", "high",
    "Description: \"Color Corrector… lightweight liquid formula… correct discoloration and dark circles\" (AR: كوركتر)."),
  "creamy-dimension-waterproof-powder": row("pressed", "compact", "medium", "none", "none", "powder-pressed", "medium",
    "Name says Powder; description: \"medium coverage and smooth effect\", a compact. A cream-to-powder compact, so it covers more than a plain powder."),
  "wet-and-dry-powder": row("pressed", "compact", "medium", "none", "none", "powder-pressed", "high",
    "Description: \"compact powder… controls excess oil\" (AR: بودرة)."),
  "setting-loose-powder": row("loose", "powder", "sheer", "none", "none", "powder-loose", "high",
    "Name and description: Loose Setting Powder, \"absorbs excess oil… smooth, velvety finish\" (AR: بودرة تثبيت)."),

  // ---------------- EYES ----------------
  "eye-define-liner": row("kohl", "pencil", "full", "none", "none", "kohl-liner", "high",
    "Description: eyeliner, \"smooth, creamy texture… waterproof and smudge-proof\" (AR: قلم كحل)."),
  "highest-shine-eye-liner": row("glossy-liquid", "liquid", "full", "glossy", "none", "liquid-liner", "high",
    "Name and description: \"High Shine Liquid Eyeliner… precision with every stroke\"."),
  "matte-dipliner-black": row("matte-liquid", "liquid", "full", "none", "none", "matte-liquid-liner", "high",
    "Name says Matte Dip Liner; description: liquid, waterproof."),
  "midnight-whisper-gel-eyeliner": row("gel", "pot", "full", "satin", "none", "gel-liner", "high",
    "Name and description: \"waterproof gel eyeliner… smooth, creamy texture\" (a gel pot)."),
  "lash-me-up-mascara": row("mascara", "liquid", "full", "none", "none", "mascara", "high", "Description: waterproof mascara, volume and length in one stroke (all-in-one)."),
  "mascara-big-volume-lashes-manifest": row("mascara", "liquid", "full", "none", "none", "mascara", "high", "Name says Big Volume."),
  "mascara-max-length-lashes-manifest": row("mascara", "liquid", "full", "none", "none", "mascara", "high", "Name says Max Length."),
  "mascara-beauty-boost-length-and-define": row("mascara", "liquid", "full", "none", "none", "mascara", "high", "Name says Length & Define."),
  "mascara-beauty-boost-volume-and-lift": row("mascara", "liquid", "full", "none", "none", "mascara", "high", "Name says Volume & Lift."),

  // ---------------- BROWS ----------------
  "browtastic-eyebrow-gel": row("pomade", "gel", "medium", "satin", "none", "brow-pomade", "medium",
    "Name says Eyebrow Gel; description: \"nourishing brow gel… shape and hold… naturally full look\". A tinted gel that fills and holds, treated like a pomade."),
  "brow-up-mascara": row("tinted", "liquid", "sheer", "satin", "none", "brow-mascara", "high",
    "Name says Brow Mascara; description: \"set and groom your brows without leaving any visible…\". Clear and tinted shades."),
  "eyebrow-styler-liner": row("pen", "liquid", "medium", "none", "none", "brow-pen", "high",
    "Description: \"24-Hour Liquid Eyebrow Definer… eyebrow pen… waterproof liquid formula\"."),
  "brow-shaping-wax": row("wax", "gel", "sheer", "glossy", "none", "brow-wax", "high",
    "Description: \"water-based formula gives your brows a naturally full and shiny look… strong hold\" (clear wax)."),
};

// Products with no try-on, and why
export const NO_TRYON = {
  "eyeshadow-creamy-stick": { finish: "cream", texture: "stick", reason: "Eyeshadow is not part of the try-on." },
  "face-illusion-blush-palette": { finish: "powder", texture: "compact", reason: "A palette with several colors in one product." },
  "face-illusion-cream-highlighter-palette": { finish: "pearl", texture: "compact", reason: "A palette with several colors in one product." },
  "face-illusion-highlighter-contour-palette": { finish: "pearl", texture: "compact", reason: "A palette with several colors in one product." },
  "correction-and-illumination-kit-3-color-correctors-and-4-color-concealers": { finish: "kit", texture: "cream", reason: "A kit of several products." },
  "matte-primer-base": { finish: "matte-soft", texture: "cream", reason: "A prep step with no visible color." },
  "matte-mizer-primer-base": { finish: "matte-soft", texture: "cream", reason: "A prep step with no visible color." },
  "make-up-prime-and-fix-spray": { finish: "setting-spray", texture: "liquid", reason: "A spray with no visible color." },
  "sunscreen-50-spf": { finish: "sunscreen", texture: "cream", reason: "Skincare, no visible color." },
};

// What the visitor sees on a card, a filter chip and in the try-on list
export const FINISH_LABEL = {
  "matte-liquid-lipstick": "Matte", "matte-lipstick": "Matte", "satin-lipstick": "Cream", "shine-lipstick": "Cream",
  "lip-tint": "Tint", "tinted-balm": "Balm", "plumping-gloss": "Gloss", "shimmer-gloss": "Shimmer gloss", "lip-oil": "Oil", "lip-liner": "Liner",
  "foundation-soft-matte": "Soft-matte", "foundation-glow": "Radiant", "bb-cream": "Dewy", "concealer-serum": "Radiant",
  "concealer-stick": "Full coverage", "color-corrector": "Corrector", "powder-pressed": "Pressed", "powder-loose": "Loose",
  "powder-blush": "Powder", "powder-cream-blush": "Powder-cream", "cream-blush": "Cream", "liquid-blush": "Liquid", "glowy-blush": "Glowy",
  "contour": "Contour", "highlighter": "Pearl",
  "kohl-liner": "Kohl", "liquid-liner": "Glossy liquid", "matte-liquid-liner": "Matte liquid", "gel-liner": "Gel", "mascara": "Mascara",
  "brow-pomade": "Pomade", "brow-mascara": "Tinted", "brow-pen": "Pen", "brow-wax": "Wax",
};
