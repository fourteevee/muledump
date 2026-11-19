import sys, os, UnityPy
src, out = sys.argv[1], sys.argv[2]
env = UnityPy.load(src)
seen = {}
for obj in env.objects:
    if obj.type.name != "TextAsset":
        continue
    d = obj.read()
    name = d.m_Name
    data = d.m_Script
    if isinstance(data, str):
        data = data.encode("utf-8", "surrogateescape")
    n = seen.get(name, 0); seen[name] = n + 1
    fn = name if n == 0 else f"{name}__{n}"
    with open(os.path.join(out, fn), "wb") as f:
        f.write(data)
print(len(seen), "names,", sum(seen.values()), "files")
