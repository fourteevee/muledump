import sys, os, UnityPy
env = UnityPy.load(sys.argv[1]); out = sys.argv[2]
for obj in env.objects:
    if obj.type.name != "Texture2D": continue
    d = obj.read()
    if d.m_Width >= 1024 and d.m_Height >= 1024 or d.m_Name in ("UntieredItems",):
        img = d.image
        fn = os.path.join(out, f"{d.m_Name}_{obj.path_id}.png")
        img.save(fn); print(fn, img.size)
