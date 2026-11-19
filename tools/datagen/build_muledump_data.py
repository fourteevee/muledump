"""Rebuild Muledump game data (constants.js, renders.png, sheets.js) from a RotMG Exalt client.

usage: build_muledump_data.py <gamedata dir> <atlas dir> <muledump/lib dir (originals)> <output dir>

gamedata dir: TextAssets exported from resources.assets (XML files + spritesheetf)
atlas dir:    exported Texture2D atlases (mapObjects_*.png, characters_*.png, characters_masks_*.png)
"""
import base64, glob, io, json, os, re, sys, time
import xml.etree.ElementTree as ET
from PIL import Image, ImageFilter, ImageChops

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common, spritedb

GD, ATL, LIB, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)

ATLAS_FILES = {2: r"characters_\d+\.png", 4: r"mapObjects_\d+\.png"}


def atlas_path(pattern):
    hits = [f for f in os.listdir(ATL) if re.fullmatch(pattern, f)]
    assert len(hits) == 1, (pattern, hits)
    return os.path.join(ATL, hits[0])


atlases = {k: Image.open(atlas_path(v)).convert("RGBA") for k, v in ATLAS_FILES.items()}
mask_atlas = Image.open(atlas_path(r"characters_masks_\d+\.png")).convert("RGBA")

sprites, _, _ = spritedb.load(os.path.join(GD, "spritesheetf"))
anims = spritedb.load_anim(os.path.join(GD, "spritesheetf"))
objs = common.load_objects(GD)
old_items = common.load_old_constants(os.path.join(LIB, "constants.js.orig"))
old_src = open(os.path.join(LIB, "constants.js.orig"), encoding="latin-1").read()


def num(text, default=0):
    if text is None or text.strip() == "":
        return default
    t = text.strip()
    try:
        return int(t, 0)
    except ValueError:
        return int(float(t))


def name_of(o):
    d = o.findtext("DisplayId")
    if d and not d.startswith("{"):
        return d
    return o.get("id")


def crop(atlas_id, pos, atlas=None):
    x, y, w, h = pos
    if w <= 0 or h <= 0:
        return None
    return (atlas or atlases[atlas_id]).crop((x, y, x + w, y + h))


def stand_frame(sheet, index):
    """Right-facing standing frame (dir 0, action 0) of an animated texture, with its mask."""
    recs = anims.get((sheet, index))
    if not recs:
        return None, None
    pick = [r for r in recs if r["dir"] == 0 and r["action"] == 0] or [r for r in recs if r["action"] == 0] or recs
    r = pick[0]
    if r.get("atlas") not in atlases:
        return None, None
    img = crop(r["atlas"], r["pos"])
    mask = crop(None, r["mask"], mask_atlas) if r["mask"][2] > 0 else None
    return img, mask


def texture_of(o):
    """Base sprite (and optional mask) for an object."""
    tx = o.find("Texture")
    if tx is not None:
        key = (tx.findtext("File"), num(tx.findtext("Index")))
        s = sprites.get(key)
        if not s or s[0] not in atlases:
            return None, None
        img = crop(s[0], s[1:5])
        mask = None
        mk = o.find("Mask")
        if mk is not None:
            ms = sprites.get((mk.findtext("File"), num(mk.findtext("Index"))))
            if ms and ms[0] in atlases:
                mask = crop(ms[0], ms[1:5])
        return img, mask
    at = o.find("AnimatedTexture")
    if at is not None:
        return stand_frame(at.findtext("File"), num(at.findtext("Index")))
    return None, None


# ---------------------------------------------------------------- textiles (cloth patterns)
textile_sizes = [4, 5, 9, 10]
textile_imgs = {}
for size in textile_sizes:
    keys = sorted(k[1] for k in sprites if k[0] == f"textile{size}x{size}")
    n = (max(keys) + 1) if keys else 0
    cols = 16
    sheet = Image.new("RGBA", (cols * size, max(1, -(-n // cols)) * size), (0, 0, 0, 0))
    for i in keys:
        s = sprites[(f"textile{size}x{size}", i)]
        if s[0] not in atlases:
            continue
        sheet.paste(crop(s[0], s[1:5]), ((i % cols) * size, (i // cols) * size))
    textile_imgs[size] = sheet


def tex_fill(tex, w, h):
    """Image filled with the colour or cloth pattern for a Tex1/Tex2 value (None if none)."""
    kind = (tex >> 24) & 0xff
    val = tex & 0xffffff
    if kind == 0:
        return None
    if kind == 1:
        return Image.new("RGBA", (w, h), ((val >> 16) & 255, (val >> 8) & 255, val & 255, 255))
    if kind in textile_imgs:
        cols = 16
        sheet = textile_imgs[kind]
        tile = sheet.crop(((val % cols) * kind, (val // cols) * kind, (val % cols + 1) * kind, (val // cols + 1) * kind))
        out = Image.new("RGBA", (w, h))
        for yy in range(0, h, kind):
            for xx in range(0, w, kind):
                out.paste(tile, (xx, yy))
        return out
    return None


def apply_dye(img, mask, tex1, tex2):
    """Paint mask channels (red=tex1, green=tex2) with their dye, shaded by mask intensity."""
    if mask is None or (not tex1 and not tex2):
        return img
    img = img.copy()
    w, h = img.size
    fills = {0: tex_fill(tex1, w, h) if tex1 else None, 1: tex_fill(tex2, w, h) if tex2 else None}
    px, mp = img.load(), mask.load()
    for y in range(min(h, mask.size[1])):
        for x in range(min(w, mask.size[0])):
            r, g, b, a = mp[x, y]
            if a < 2:
                continue
            ch = 0 if r > g else 1 if g > r else None
            if ch is None or fills[ch] is None:
                continue
            vol = r if ch == 0 else g
            fr, fg, fb, _ = fills[ch].getpixel((x, y))
            px[x, y] = (fr * vol // 255, fg * vol // 255, fb * vol // 255, max(px[x, y][3], 255))
    return img


def render_icon(img):
    """40x40 Muledump-style icon: sprite scaled to ~32px, 2px black outline, soft drop shadow."""
    w, h = img.size
    scale = max(1, 32 // max(w, h))
    big = img.resize((w * scale, h * scale), Image.NEAREST)
    cell = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    ox, oy = (40 - big.width) // 2, (40 - big.height) // 2
    layer = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    layer.paste(big, (ox, oy))
    alpha = layer.getchannel("A").point(lambda v: 255 if v > 0 else 0)
    outline = alpha.filter(ImageFilter.MaxFilter(5))
    shadow = outline.filter(ImageFilter.GaussianBlur(2.5)).point(lambda v: v * 0.55)
    black = Image.new("RGBA", (40, 40), (0, 0, 0, 255))
    cell.paste(black, (0, 0), shadow)
    cell.paste(black, (0, 0), outline)
    cell.alpha_composite(layer)
    return cell


# ---------------------------------------------------------------- items
#  always start from the untouched 9.6.5 sheet so re-runs don't stack new icons
_base = os.path.join(LIB, "renders.png.orig")
old_png = Image.open(_base if os.path.exists(_base) else os.path.join(LIB, "renders.png")).convert("RGBA")
COLS = old_png.width // 40
icon_cells = {}      # dedupe key -> (x, y)
new_icons = []       # list of (x, y, Image)
next_cell = [0]
base_rows = old_png.height // 40


def cell_for(key, make):
    if key in icon_cells:
        return icon_cells[key]
    img = make()
    if img is None:
        return None
    i = next_cell[0]; next_cell[0] += 1
    xy = ((i % COLS) * 40, (base_rows + i // COLS) * 40)
    icon_cells[key] = xy
    new_icons.append((xy, img))
    return xy


items = dict(old_items)
stats = {"updated": 0, "added": 0, "noicon": 0}
#  anything that can sit in an inventory: equipment, dyes, and item-form emotes / entrances (e.g. from gift chests)
item_objs = {k: o for k, o in objs.items() if o.findtext("Class") in ("Equipment", "Dye") or o.find("Item") is not None}
for t, o in sorted(item_objs.items()):
    tex1 = num(o.findtext("Tex1")); tex2 = num(o.findtext("Tex2"))
    tx = o.find("Texture"); at = o.find("AnimatedTexture")
    if tx is not None:
        tkey = ("T", tx.findtext("File"), num(tx.findtext("Index")))
    elif at is not None:
        tkey = ("A", at.findtext("File"), num(at.findtext("Index")))
    else:
        tkey = None

    def make(o=o, tex1=tex1, tex2=tex2):
        img, mask = texture_of(o)
        if img is None:
            return None
        return render_icon(apply_dye(img, mask, tex1, tex2))

    xy = cell_for((tkey, tex1, tex2), make) if tkey else None
    if xy is None:
        stats["noicon"] += 1
        xy = (old_items[t][3], old_items[t][4]) if t in old_items else (40, 0)  # fall back to old art / unknown icon
    labels = set((o.findtext("Labels") or "").replace(" ", "").split(","))
    utst = 2 if "ST" in labels else 1 if "UT" in labels else 0
    entry = [
        name_of(o),
        num(o.findtext("SlotType")),
        num(o.findtext("Tier"), -1),
        xy[0], xy[1],
        num(o.findtext("FameBonus")),
        num(o.findtext("feedPower")),
        num(o.findtext("BagType")),
        o.find("Soulbound") is not None,
        utst,
    ]
    stats["updated" if t in items else "added"] += 1
    items[t] = entry

# ---------------------------------------------------------------- pets
pets = {}
for t, o in sorted(objs.items()):
    if o.findtext("Class") == "Pet":
        pets[t] = [name_of(o), o.findtext("Family") or "", o.findtext("Rarity") or "", o.findtext("DefaultSkin") or ""]
skin_ids = {o.get("id"): t for t, o in objs.items() if o.findtext("Class") == "PetSkin"}
pet_skins = {}
for t, o in sorted(objs.items()):
    if o.findtext("Class") != "PetSkin":
        continue
    tx = o.find("Texture"); at = o.find("AnimatedTexture")
    src = tx if tx is not None else at
    if src is None:
        continue
    def make_pet(o=o):
        img, _ = texture_of(o)
        return render_icon(img) if img is not None else None
    xy = cell_for((("P" if tx is not None else "PA"), src.findtext("File"), num(src.findtext("Index"))), make_pet)
    if xy:
        pet_skins[t] = [name_of(o), xy[0], xy[1]]
for t, v in pets.items():
    v[3] = skin_ids.get(v[3], 0)   # default skin name -> type id

#  pet ability ids collide with other object types, so read them straight from the pets file
import xml.etree.ElementTree as ET
pet_abilities = {num(o.get("type")): name_of(o) for o in ET.parse(os.path.join(GD, "pets")).getroot().iter("Object")
                 if o.findtext("Class") == "PetAbility"}

# ---------------------------------------------------------------- exaltation, fame system, shiny items
exalt_root = ET.parse(os.path.join(GD, "exaltationConfig")).getroot()
exalt_dungeons = []
for dg in exalt_root.iter("Dungeon"):
    key = (dg.findtext("IconFile"), num(dg.findtext("IconIndex")))
    def make_exalt(key=key):
        s_ = sprites.get(key)
        return render_icon(crop(s_[0], s_[1:5])) if s_ and s_[0] in atlases else None
    xy = cell_for(("X",) + key, make_exalt) or (40, 0)
    exalt_dungeons.append([dg.findtext("PowerUp"), dg.findtext("Name"), dg.findtext("AltDungeon") or "", xy[0], xy[1]])

players_root = ET.parse(os.path.join(GD, "players")).getroot()
player_stats = {num(ps.get("index")): [ps.get("id"), ps.get("displayName") or ""] for ps in players_root.iter("PlayerStat")}
fame_bonuses = []
for fb in players_root.iter("FameBonus"):
    conds = []
    for c in fb.findall("Condition"):
        if c.text == "StatValue":
            conds.append([c.get("stat"), num(c.get("threshold"))])
        elif c.text == "MaxedStat":
            conds.append(["#maxed", c.get("stat")])
        else:
            conds.append(["#" + (c.text or "")])
    fame_bonuses.append([
        fb.findtext("DisplayName") or fb.get("id"), fb.findtext("DisplayGroup") or "", fb.findtext("DisplayCategory") or "",
        float(fb.findtext("AbsoluteBonus") or 0), float(fb.findtext("RelativeBonus") or 0),
        (fb.findtext("Repeatable") or "").lower() == "true", num(fb.findtext("MaxRepeatCount"), 0),
        fb.findtext("Description") or "", conds,
    ])
shiny_items = sorted(t for t, o in item_objs.items() if "SHINY" in (o.findtext("Labels") or "").split(","))

rows = base_rows + -(-next_cell[0] // COLS)
png = Image.new("RGBA", (old_png.width, rows * 40), (0, 0, 0, 0))
png.paste(old_png, (0, 0))
for (x, y), img in new_icons:
    png.paste(img, (x, y))
png.save(os.path.join(OUT, "renders.png"), optimize=True)

# ---------------------------------------------------------------- classes
STATS = "MaxHitPoints MaxMagicPoints Attack Defense Speed Dexterity HpRegen MpRegen".split()
classes = {}
for t, o in sorted(objs.items()):
    if o.findtext("Class") != "Player":
        continue
    base, avg, mx = [], [], []
    inc = {li.text: (num(li.get("min")), num(li.get("max"))) for li in o.findall("LevelIncrease")}
    for s in STATS:
        e = o.find(s)
        b = num(e.text) if e is not None else 0
        base.append(b)
        mx.append(num(e.get("max")) if e is not None and e.get("max") else b)
        lo, hi = inc.get(s, (0, 0))
        a = b + 19 * (lo + hi) / 2
        avg.append(int(a) if a == int(a) else a)
    slots = [int(x) for x in (o.findtext("SlotTypes") or "0,0,0,0").split(",")[:4]]
    classes[t] = [name_of(o), base, avg, mx, slots]

# ---------------------------------------------------------------- skins + skin sheets
sheet_frames = {8: [], 16: []}   # list of (img, mask)
skins = {}


def add_skin(t, name, sheet, index, cls):
    img, mask = stand_frame(sheet, index)
    if img is None:
        return False
    size = 16 if max(img.size) > 8 else 8
    frame = Image.new("RGBA", (size, size)); fmask = Image.new("RGBA", (size, size))
    off = ((size - img.width) // 2, size - img.height)
    frame.paste(img, off)
    if mask is not None:
        # keep only pixels that clearly belong to one dye channel
        m = Image.new("RGBA", mask.size)
        mp, src = m.load(), mask.load()
        for y in range(mask.height):
            for x in range(mask.width):
                r, g, b, a = src[x, y]
                if a > 1 and r != g:
                    mp[x, y] = (r, g, 0, 255)
        fmask.paste(m, off)
    sheet_frames[size].append((frame, fmask))
    skins[t] = [name, len(sheet_frames[size]) - 1, size == 16, f"exalt{size}", cls]
    return True


missing_skins = 0
for t, o in sorted(classes.items()):
    at = objs[t].find("AnimatedTexture")
    if at is None or not add_skin(t, o[0], at.findtext("File"), num(at.findtext("Index")), t):
        missing_skins += 1
for t, o in sorted(objs.items()):
    if o.findtext("Class") != "Skin":
        continue
    at = o.find("AnimatedTexture"); cls = num(o.findtext("PlayerClassType"), 0)
    if at is None or cls not in classes or not add_skin(t, name_of(o), at.findtext("File"), num(at.findtext("Index")), cls):
        missing_skins += 1

skinsheets = {}
for size, frames in sheet_frames.items():
    h = max(1, len(frames)) * size * 3
    img = Image.new("RGBA", (size, h)); msk = Image.new("RGBA", (size, h))
    for i, (f, m) in enumerate(frames):
        img.paste(f, (0, i * size * 3)); msk.paste(m, (0, i * size * 3))
    skinsheets[f"exalt{size}"] = img; skinsheets[f"exalt{size}Mask"] = msk

# ---------------------------------------------------------------- textures (dyes / cloths)
textures = {}  # rebuilt entirely from game data; the old table is a subset
for t, o in sorted(objs.items()):
    if o.findtext("Class") != "Dye":
        continue
    for slot, tag in ((0, "Tex1"), (1, "Tex2")):
        v = num(o.findtext(tag))
        if not v:
            continue
        e = textures.setdefault(v, ["", None, "", None])
        e[slot * 2] = name_of(o); e[slot * 2 + 1] = t

# ---------------------------------------------------------------- write constants.js
def js(v):
    if v is True: return "true"
    if v is False: return "false"
    if v is None: return "0"
    if isinstance(v, str): return json.dumps(v)
    if isinstance(v, list): return "[" + ", ".join(js(x) for x in v) + "]"
    return repr(v)


build = time.strftime("%Y%m%d-%H%M%S")
lines = [
    "/**",
    " * Generated by build_muledump_data.py from the local RotMG Exalt client data",
    " * (merged over the original Jakcodex/Muledump 9.6.5 constants)",
    " */",
    "",
    f'rendersVersion = "renders-{build}-exalt";',
    "",
    "//   type: [\"id\", SlotType, Tier, x, y, FameBonus, feedPower, BagType, Soulbound, UT/ST],",
    "items = {",
]
for k in sorted(items, key=lambda k: (k != -1, k)):
    key = "'-1'" if k == -1 else f"0x{k:x}"
    lines.append(f"  {key}: {js(items[k])},")
lines += ["};", "", "//   type: [\"id\", base stats, averages, maxes, slots]", "classes = {"]
for k, v in sorted(classes.items()):
    lines.append(f"  0x{k:04x}: {js(v)},")
lines += ["};", "", "//   type: [\"id\", index, 16x16, \"sheet\", class]", "skins = {"]
for k, v in sorted(skins.items()):
    lines.append(f"  0x{k:04x}: [{js(v[0])}, {v[1]}, {js(v[2])}, {js(v[3])}, 0x{v[4]:04x}],")
lines += ["};", "", "petAbilities = {"]
for k, v in sorted(pet_abilities.items()):
    lines.append(f"  {k}: {js(v)},")
lines += ["};", "", "//   type: [\"name\", \"family\", \"rarity\", defaultSkin]", "pets = {"]
for k, v in sorted(pets.items()):
    lines.append(f"  {k}: {js(v)},")
lines += ["};", "", "//   type: [\"name\", x, y]", "petSkins = {"]
for k, v in sorted(pet_skins.items()):
    lines.append(f"  {k}: {js(v)},")
lines += ["};", "", "//   index: [\"id\", \"display name\"]  (PCStats)", "playerStats = {"]
for k, v in sorted(player_stats.items()):
    lines.append(f"  {k}: {js(v)},")
lines += ["};", "", "//   [name, group, category, absolute, relative %, repeatable, maxRepeat, description, conditions]",
          "//   conditions: [statId, threshold] | [\"#maxed\", stat] | [\"#FirstCharacter\"]", "fameBonuses = ["]
for v in fame_bonuses:
    lines.append(f"  {js(v)},")
lines += ["];", "", "//   [powerUp, dungeon, altDungeon, iconX, iconY]", "exaltationDungeons = ["]
for v in exalt_dungeons:
    lines.append(f"  {js(v)},")
#  cosmetics: read from their own files (type ids collide with other objects)
def cosmetic_table(fn, cls):
    out = {}
    path = os.path.join(GD, fn)
    if not os.path.exists(path):
        return out
    for o in ET.parse(path).getroot().iter("Object"):
        if o.findtext("Class") == cls:
            out[num(o.get("type"))] = o
    return out
cos_titles = cosmetic_table("titles", "Title")
cos_emotes = cosmetic_table("emotes", "Emote")
cos_entrances = cosmetic_table("entrances", "Entrance")
lines += ["];", "", "//   titles: [name, Prefix|Suffix, tier]; emotes / entrances: name", "cosmetics = {", "  titles: {"]
for k, o in sorted(cos_titles.items()):
    lines.append(f"    {k}: {js([o.findtext('DisplayId') or '', o.findtext('TitleType') or '', num(o.findtext('TitleTier'), 0)])},")
lines += ["  },", "  emotes: {"]
for k, o in sorted(cos_emotes.items()):
    lines.append(f"    {k}: {js(re.sub(r' [(]emote[)]$', '', name_of(o)))},")
lines += ["  },", "  entrances: {"]
for k, o in sorted(cos_entrances.items()):
    lines.append(f"    {k}: {js(name_of(o))},")
lines += ["  }", "};", ""]
lines += ["shinyItems = {" + ", ".join(f"0x{t:x}: 1" for t in shiny_items) + "};", "", "textures = {"]
for k, v in sorted(textures.items()):
    lines.append(f"0x{k:08X}: [{js(v[0])}, 0x{(v[1] or 0):x}, {js(v[2])}, 0x{(v[3] or 0):x}],")
lines += ["};", "", "//   type: [\"name\", \"description\", x, y]  (x/y in enchantments.png, 16px cells)", "enchantments = {"]
import xml.etree.ElementTree as ET
ench_cells, ench_imgs = {}, []
for e in ET.parse(os.path.join(GD, "enchantments")).getroot().iter("Enchantment"):
    xy = (0, 0)
    tx = e.find("Texture")
    if tx is not None:
        key = (tx.findtext("File"), num(tx.findtext("Index")))
        if key not in ench_cells and key in sprites and sprites[key][0] in atlases:
            i = len(ench_imgs); ench_cells[key] = ((i % 32) * 16, (i // 32) * 16)
            img = crop(sprites[key][0], sprites[key][1:5])
            tile = Image.new("RGBA", (16, 16)); tile.paste(img, ((16 - img.width) // 2, (16 - img.height) // 2))
            ench_imgs.append(tile)
        xy = ench_cells.get(key, (0, 0))
    lines.append(f"  0x{num(e.get('type')):x}: {js([name_of(e), (e.findtext('Description') or '').strip(), xy[0], xy[1]])},")
esheet = Image.new("RGBA", (32 * 16, max(1, -(-len(ench_imgs) // 32)) * 16))
for i, tile in enumerate(ench_imgs):
    esheet.paste(tile, ((i % 32) * 16, (i // 32) * 16))
esheet.save(os.path.join(OUT, "enchantments.png"), optimize=True)
lines += ["};", ""]
open(os.path.join(OUT, "constants.js"), "w", encoding="utf-8").write("\n".join(lines))

# ---------------------------------------------------------------- write sheets.js
def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


with open(os.path.join(OUT, "sheets.js"), "w") as f:
    f.write("textiles = {\n" + ",\n".join(f"    {k}: '{b64(v)}'" for k, v in textile_imgs.items()) + "\n};\n\n")
    f.write("skinsheets = {\n" + ",\n".join(f"    {k}: '{b64(v)}'" for k, v in skinsheets.items()) + "\n};\n\n")
    f.write("renders = '" + b64(png) + "';\n")

print(json.dumps({**stats, "items_total": len(items), "icons": next_cell[0], "png": png.size,
                  "classes": len(classes), "skins": len(skins), "skins_missing": missing_skins,
                  "skin8": len(sheet_frames[8]), "skin16": len(sheet_frames[16]), "textures": len(textures)}))
