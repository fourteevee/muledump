import os, re, sys, xml.etree.ElementTree as ET
def load_objects(gd):
    """All <Object> elements from every XML asset, keyed by type id (last definition wins)."""
    objs = {}
    for fn in sorted(os.listdir(gd)):
        p = os.path.join(gd, fn)
        if not os.path.isfile(p): continue
        if b"<Objects" not in open(p, "rb").read(300): continue
        for o in ET.parse(p).getroot().iter("Object"):
            objs[int(o.get("type"), 0)] = o
    return objs
def load_old_constants(path):
    """Parse the bundled constants.js items table: id -> list of fields."""
    s = open(path, encoding="latin-1").read()
    i = s.index("\nitems = {"); j = s.index("\n};", i)
    out = {}
    for m in re.finditer(r"^\s*(0x[0-9a-fA-F]+|'-1'):\s*\[(.*)\],?\s*$", s[i:j], re.M):
        k = -1 if m.group(1) == "'-1'" else int(m.group(1), 16)
        out[k] = eval("[" + m.group(2).replace("true", "True").replace("false", "False") + "]", {"__builtins__": {}})
    return out
