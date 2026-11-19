"""Decode RotMG Exalt spritesheetf (FlatBuffers) into {(sheetName, index): (atlasId, x, y, w, h, mx, my, mw, mh)}."""
import struct
def load(path):
    b = open(path, "rb").read()
    u32 = lambda o: struct.unpack_from("<I", b, o)[0]
    i32 = lambda o: struct.unpack_from("<i", b, o)[0]
    u16 = lambda o: struct.unpack_from("<H", b, o)[0]
    def fields(t):
        vt = t - i32(t); n = (u16(vt) - 4) // 2
        return [u16(vt + 4 + 2*i) for i in range(n)]
    ref = lambda p: p + u32(p)
    def string(p): s = ref(p); return b[s+4:s+4+u32(s)].decode()
    def vec(p): v = ref(p); return [v + 4 + 4*i for i in range(u32(v))]
    def fld(f, i): return f[i] if i < len(f) else 0
    root = u32(0); rf = fields(root)
    db = {}
    for e in vec(root + rf[0]):
        t = ref(e); f = fields(t)
        name = string(t + f[0])
        for k in vec(t + f[2]):
            s = ref(k); sf = fields(s)
            pos = struct.unpack_from("<4f", b, s + sf[0]) if fld(sf,0) else (0,0,0,0)
            mask = struct.unpack_from("<4f", b, s + sf[1]) if fld(sf,1) else (0,0,0,0)
            idx = u32(s + sf[3]) if fld(sf,3) else 0
            atlas = u32(s + sf[7]) if fld(sf,7) else 0
            db[(name, idx)] = (atlas,) + tuple(int(v) for v in pos) + tuple(int(v) for v in mask)
    # animated sprites (characters/skins): field1 -> list of {name, index?, ..., sprite}
    anim = {}
    if len(rf) > 1 and rf[1]:
        for e in vec(root + rf[1]):
            t = ref(e); f = fields(t)
            anim.setdefault("_raw", []).append(t)
    return db, b, anim

def load_anim(path):
    """Animated sprites: {(sheetName, index): [ {set, dir, action, atlas, pos(x,y,w,h), mask(x,y,w,h)} ...]}"""
    b = open(path, "rb").read()
    u32 = lambda o: struct.unpack_from("<I", b, o)[0]
    i32 = lambda o: struct.unpack_from("<i", b, o)[0]
    u16 = lambda o: struct.unpack_from("<H", b, o)[0]
    def fields(t):
        vt = t - i32(t); n = (u16(vt) - 4) // 2
        return [u16(vt + 4 + 2*i) for i in range(n)]
    ref = lambda p: p + u32(p)
    def string(p): s = ref(p); return b[s+4:s+4+u32(s)].decode()
    def vec(p): v = ref(p); return [v + 4 + 4*i for i in range(u32(v))]
    fld = lambda f, i: f[i] if i < len(f) else 0
    root = u32(0); rf = fields(root)
    out = {}
    for e in vec(root + rf[1]):
        t = ref(e); f = fields(t)
        name = string(t + f[0])
        g = lambda i: u32(t + f[i]) if fld(f, i) else 0
        rec = {"index": g(1), "set": g(2), "dir": g(3), "action": g(4)}
        if fld(f, 5):
            s = ref(t + f[5]); sf = fields(s)
            rec["pos"] = tuple(int(v) for v in struct.unpack_from("<4f", b, s + sf[0])) if fld(sf, 0) else (0,0,0,0)
            rec["mask"] = tuple(int(v) for v in struct.unpack_from("<4f", b, s + sf[1])) if fld(sf, 1) else (0,0,0,0)
            rec["atlas"] = u32(s + sf[7]) if fld(sf, 7) else 0
        out.setdefault((name, rec["index"]), []).append(rec)
    return out
