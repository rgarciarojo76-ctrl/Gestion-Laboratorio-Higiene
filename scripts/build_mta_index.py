#!/usr/bin/env python3
"""
Scraper: Builds a CAS → MTA INSST PDF URL pre-indexed mapping.

Strategy:
1. Parse MTA method titles from the INSST website to extract the chemical substances.
2. Cross-reference with a known CAS mapping for common industrial hygiene substances.
3. Generate a static JSON file for instant client-side lookup.
"""

import json
import re

# ── Hardcoded MTA methods scraped from INSST website ─────────────────────────
# Format: (MTA code, chemical description, direct PDF URL, [CAS numbers])
MTA_METHODS = [
    # === MA series (Métodos Ambientales) ===
    ("MTA/MA-011/A87", "plomo en aire", "https://www.insst.es/documents/94886/359043/MA_065_A16.pdf", ["7439-92-1"]),
    ("MTA/MA-012/A87", "cloruro de vinilo en aire", "https://www.insst.es/documents/94886/359043/MA_012_A87.pdf/9229d633-9010-4aab-a494-8d8327dcad88", ["75-01-4"]),
    ("MTA/MA-013/A16", "hidrocarburos clorados (tricloroetileno, tetracloroetileno, 1,1,1-tricloroetano)", "https://www.insst.es/documents/94886/359043/MA_013_R87.pdf/dec64613-d46e-472f-af8f-2e3d7b8f3698", ["79-01-6", "127-18-4", "71-55-6"]),
    ("MTA/MA-014/A11", "materia particulada (fracciones inhalable, torácica y respirable)", "https://www.insst.es/documents/94886/359043/MA_014_A11.pdf/687c3305-70c6-4f12-9115-4c317d7e819f", []),
    ("MTA/MA-015/R88", "disolventes adhesivos (n-hexano y tolueno) difusión", "https://www.insst.es/documents/94886/359043/MA_015_R88.pdf/e9557816-64b3-4393-a488-26f1bd3d30ec", ["110-54-3", "108-88-3"]),
    ("MTA/MA-016/A89", "alcoholes (2-propanol, 2-metil-1-propanol, 1-butanol)", "https://www.insst.es/documents/94886/359043/MA_016_A89.pdf/26932db5-961c-47bb-9b75-c994db229e36", ["67-63-0", "78-83-1", "71-36-3"]),
    ("MTA/MA-017/A89", "glicol éteres (1-metoxi-2-propanol, 2-etoxietanol)", "https://www.insst.es/documents/94886/359043/MA_017_A89.pdf/03e484fa-48ee-40d3-b13f-c90333fb8d46", ["107-98-2", "110-80-5"]),
    ("MTA/MA-018/A89", "formaldehído en aire (ácido cromotrópico)", "https://www.insst.es/documents/94886/359043/MA_018_A89.pdf/78d7ab18-cb54-4389-bddb-8fc358cfc4b8", ["50-00-0"]),
    ("MTA/MA-019/A90", "aniones de ácidos inorgánicos en aire", "https://www.insst.es/documents/94886/359043/MA_019_A90.pdf/42121c96-6bd5-40ac-bdb9-b2a4b99289cc", []),
    ("MTA/MA-020/A91", "óxido de dinitrógeno en aire", "https://www.insst.es/documents/94886/359043/MA_020_A91.pdf/06047740-1930-486d-9025-37f1318fab30", ["10024-97-2"]),
    ("MTA/MA-021/A91", "aminas alifáticas terciarias (etildimetilamina)", "https://www.insst.es/documents/94886/359043/MA_021_A91.pdf/0dcf0dc8-18c3-48f9-a1eb-6496a313a53d", ["598-56-1"]),
    ("MTA/MA-022/A91", "óxido de etileno en aire", "https://www.insst.es/documents/94886/359043/MA_022_A91.pdf/0b6b2a83-0a14-4a24-86cc-dd33a17737b3", ["75-21-8"]),
    ("MTA/MA-023/A92", "ésteres I (acetato de metilo, acetato de etilo, acetato de isobutilo, acetato de n-butilo)", "https://www.insst.es/documents/94886/359043/MA_023_A92.pdf/e3533526-8759-45d3-a305-e6b89a09e053", ["79-20-9", "141-78-6", "110-19-0", "123-86-4"]),
    ("MTA/MA-024/A92", "ésteres II (acetato de 1-metoxi-2-propilo, acetato de 2-etoxietilo)", "https://www.insst.es/documents/94886/359043/MA_024_A92.pdf/0852496b-1685-4fbb-a995-86efa398664a", ["108-65-6", "111-15-9"]),
    ("MTA/MA-025/A16", "metales y compuestos iónicos en aire (absorción atómica)", "https://www.insst.es/documents/94886/359043/MA_025_A16.pdf/5f447f11-1194-41cc-aa97-0720e855677f", []),
    ("MTA/MA-026/A92", "estireno en aire (difusión)", "https://www.insst.es/documents/94886/359043/MA_026_A92.pdf/e4c7e7e5-70e2-488c-9933-a37500ff8636", ["100-42-5"]),
    ("MTA/MA-027/A95", "isoflurano en aire (difusión)", "https://www.insst.es/documents/94886/359043/MA_027_A95.pdf/0cd14bc1-26aa-4fda-a9e6-d9b74a131d3e", ["26675-46-7"]),
    ("MTA/MA-028/A96", "estireno en aire (desorción térmica)", "https://www.insst.es/documents/94886/359043/MA_028_A96.pdf/12b3e988-0eb0-4ced-aca9-d469098298dc", ["100-42-5"]),
    ("MTA/MA-029/A92", "hidrocarburos alifáticos (n-hexano, n-heptano, n-octano, n-nonano)", "https://www.insst.es/documents/94886/359043/MA_029_A92.pdf/192454a9-52ed-40e6-a212-3e0b9a4b8f42", ["110-54-3", "142-82-5", "111-65-9", "111-84-2"]),
    ("MTA/MA-030/A92", "hidrocarburos aromáticos (benceno, tolueno, etilbenceno, p-xileno, 1,2,4-trimetilbenceno)", "https://www.insst.es/documents/94886/359043/MA_030_A92.pdf/ac88773d-81a9-4408-854d-d2451d16a2c7", ["71-43-2", "108-88-3", "100-41-4", "106-42-3", "95-63-6"]),
    ("MTA/MA-031/A96", "cetonas (acetona, metil etil cetona, metil isobutil cetona)", "https://www.insst.es/documents/94886/359043/MA_031_A96.pdf/de1835bb-3183-4018-b12b-d59886e29866", ["67-64-1", "78-93-3", "108-10-1"]),
    ("MTA/MA-032/A98", "vapores orgánicos en aire", "https://www.insst.es/documents/94886/359043/MA_032_A98.pdf/3b41758a-2677-4a80-9f44-d4861169e309", []),
    ("MTA/MA-034/A95", "isocianatos orgánicos (2,6 y 2,4 TDI, HDI, MDI)", "https://www.insst.es/documents/94886/359043/MA_034_A95.pdf/ac32da34-8486-41ed-a360-5130dca3c133", ["91-08-7", "584-84-9", "822-06-0", "101-68-8"]),
    ("MTA/MA-035/A96", "arsénico y compuestos en aire", "https://www.insst.es/documents/94886/359043/MA_035_A96.pdf/3c16566c-b8b4-4fd1-853c-86f4ae471e8e", ["7440-38-2"]),
    ("MTA/MA-036/A00", "cuarzo en aire (difracción de rayos X)", "https://www.insst.es/documents/94886/359043/MA_036_A00.pdf/a5003f72-51df-4d27-9fc1-c19005c281de", ["14808-60-7"]),
    ("MTA/MA-037/A96", "nitrobenceno en aire", "https://www.insst.es/documents/94886/359043/MA_037_A96.pdf/48064665-7437-4687-b0ad-131adbbc389e", ["98-95-3"]),
    ("MTA/MA-038/A02", "piridina en aire", "https://www.insst.es/documents/94886/359043/MA_038_A02.pdf/27e19f40-58d4-4957-97ba-535de8385c8d", ["110-86-1"]),
    ("MTA/MA-039/A00", "hidrocarburos policíclicos en aire", "https://www.insst.es/documents/94886/359043/MA_039_A00.pdf/f74993bd-7769-4259-aeac-088d6f6df710", []),
    ("MTA/MA-040/A98", "fenol en aire", "https://www.insst.es/documents/94886/359043/MA_040_A98.pdf/2d3960e0-fa7f-42b0-83a4-2a8ca38d81b9", ["108-95-2"]),
    ("MTA/MA-041/A99", "ésteres III (acetato de n-propilo, acetato de isoamilo, acetato de n-amilo)", "https://www.insst.es/documents/94886/359043/MA_041_A99.pdf/33ddfad8-a9e7-4558-801f-8a4033a1fe65", ["109-60-4", "123-92-2", "628-63-7"]),
    ("MTA/MA-042/A99", "hidrocarburos clorados II (tetracloruro de carbono, cloroformo, clorobenceno)", "https://www.insst.es/documents/94886/359043/MA_042_A99.pdf/8fb31abe-a0e8-4c62-9deb-da4bf1591ce2", ["56-23-5", "67-66-3", "108-90-7"]),
    ("MTA/MA-043/A99", "hidrocarburos clorados III (1,1-dicloroetano, 1,2-dicloroetano, 1,2-dicloropropano)", "https://www.insst.es/documents/94886/359043/MA_043_A99.pdf/136cdaee-8a64-463a-b606-00686e22b274", ["75-34-3", "107-06-2", "78-87-5"]),
    ("MTA/MA-044/A99", "cloruro de metileno en aire", "https://www.insst.es/documents/94886/359043/MA_044_A99.pdf/6455032d-d1b7-4a23-8539-415716d93f59", ["75-09-2"]),
    ("MTA/MA-045/A00", "hidrocarburos clorados en aire", "https://www.insst.es/documents/94886/359043/MA_045_A00.pdf/8057211e-c256-4f96-95f8-4ed379a3f2b2", []),
    ("MTA/MA-046/A00", "gases anestésicos (desflurano, sevoflurano, isoflurano, halotano)", "https://www.insst.es/documents/94886/359043/MA_046_A00.pdf/b749ef41-106f-4f1d-96b5-0e3487067094", ["57041-67-5", "28523-86-6", "26675-46-7", "151-67-7"]),
    ("MTA/MA-047/A01", "éteres I (éter dietílico, éter diisopropílico, éter metil ter-butílico)", "https://www.insst.es/documents/94886/359043/MA_047_A01.pdf/1997cf2f-df3b-413d-a976-c7d05ea6b996", ["60-29-7", "108-20-3", "1634-04-4"]),
    ("MTA/MA-048/A01", "éteres II (éter isopropilglicidílico, éter n-butilglicidílico)", "https://www.insst.es/documents/94886/359043/MA_048_A01.pdf/30a43acc-d8ef-4480-b474-aace21a5100d", ["4016-14-2", "2426-08-6"]),
    ("MTA/MA-049/A01", "tetrahidrofurano en aire", "https://www.insst.es/documents/94886/359043/MA_049_A01.pdf/ceffc7a6-f5a2-4277-a126-c071315216c5", ["109-99-9"]),
    ("MTA/MA-050/A02", "bromoformo en aire", "https://www.insst.es/documents/94886/359043/MA_050_A02.pdf/bb636170-e01e-4013-a590-327d2c930994", ["75-25-2"]),
    ("MTA/MA-051/A04", "fibras de amianto y otras fibras en aire", "https://www.insst.es/documents/94886/359043/MA_051_A04.pdf/4823bc2c-2e9b-4fa8-89b6-bd85fca6085f", ["1332-21-4"]),
    ("MTA/MA-052/A02", "cetonas II en aire", "https://www.insst.es/documents/94886/359043/MA_052_A02.pdf/0b2cf00b-c360-446a-b088-6ec012e3488e", []),
    ("MTA/MA-053/A02", "hidrocarburos aromáticos clorados (cloruro de bencilo, 1,2-diclorobenceno)", "https://www.insst.es/documents/94886/359043/MA_053_A02.pdf/3a2eca1e-1afc-463c-b23e-67145924274a", ["100-44-7", "95-50-1"]),
    ("MTA/MA-054/A04", "acrilatos (acrilato de etilo, acrilato de n-butilo)", "https://www.insst.es/documents/94886/359043/MA_054_A04.pdf/22fb3489-0a1b-4d14-b46a-cb0974bb1580", ["140-88-5", "141-32-2"]),
    ("MTA/MA-055/A04", "acetonitrilo en aire", "https://www.insst.es/documents/94886/359043/MA_055_A04.pdf/9c0a6c72-272b-4869-a4df-68ba955e089c", ["75-05-8"]),
    ("MTA/MA-056/A06", "sílice libre cristalina (cuarzo, cristobalita, tridimita) DRX", "https://www.insst.es/documents/94886/359043/MA_056_A06.pdf/6874e506-7697-49c6-ae77-ee55dc53e9a5", ["14808-60-7", "14464-46-1", "15468-32-3"]),
    ("MTA/MA-057/A17", "sílice cristalina (fracción respirable) IR", "https://www.insst.es/documents/94886/359043/MA_057_A04.pdf/0a4d3651-902d-41ad-8e18-8408ac6b79a4", ["14808-60-7"]),
    ("MTA/MA-058/A05", "alcoholes II (alcohol sec-butílico)", "https://www.insst.es/documents/94886/359043/MA_058_A05.pdf/c2d06498-d4de-47d2-9481-1e34c8de3ce9", ["78-92-2"]),
    ("MTA/MA-059/A06", "alcoholes III (alcohol isopropílico, alcohol n-propílico, alcohol isobutílico)", "https://www.insst.es/documents/94886/359043/MA_059_A06.pdf/f0f3e702-0347-4679-b0d4-3abfacf4eb18", ["67-63-0", "71-23-8", "78-83-1"]),
    ("MTA/MA-060/A05", "ácidos inorgánicos I (ácido fosfórico y ácido sulfúrico)", "https://www.insst.es/documents/94886/359043/MA_060_A05.pdf/40e364aa-7d95-496f-a132-26e3219c3ee9", ["7664-38-2", "7664-93-9"]),
    ("MTA/MA-061/A14", "hidrocarburos aromáticos (tolueno, etilbenceno, m-xileno, estireno) desorción térmica", "https://www.insst.es/documents/94886/359043/MA_061_A14.pdf/c85e73bc-0e52-49d6-bf14-33e9a0c07c65", ["108-88-3", "100-41-4", "108-38-3", "100-42-5"]),
    ("MTA/MA-062/A23", "formaldehído en aire (DNPH/HPLC)", "https://www.insst.es/documents/94886/359043/MA_062_A23.pdf/520be083-f1ff-31ea-f4db-f12bc49766bc", ["50-00-0"]),
    ("MTA/MA-063/A23", "cromo hexavalente en aire (fracción inhalable)", "https://www.insst.es/documents/94886/359043/MA_063_A23.pdf/0c2b4fd9-21db-9822-bf8f-e6793f9273f4", ["7440-47-3", "18540-29-9"]),
    ("MTA/MA-064/A07", "alcohol etílico en aire", "https://www.insst.es/documents/94886/359043/mta_ma_064_a07.pdf/0422e253-91bd-42f0-8741-c630e5b01cc1", ["64-17-5"]),
    ("MTA/MA-065/A16", "metales y compuestos iónicos en aire (ICP-AES)", "https://www.insst.es/documents/94886/359043/MA_065_A16.pdf/bdbe1c22-ccaf-45d2-a9b8-2a93d9c0cac5", []),
    ("MTA/MA-066/A19", "benceno en aire (difusión, desorción térmica)", "https://www.insst.es/documents/94886/359043/MA_066_A19.pdf/b2dbc91b-0928-4fb9-a040-118044b67bf7", ["71-43-2"]),
    ("MTA/MA-067/A24", "diisocianato de 2,6-tolueno en aire", "https://www.insst.es/documents/94886/359043/MA_067_A24.pdf/53e30732-02e1-bfb3-b63f-9b3b3b8e0b66", ["91-08-7"]),
    ("MTA/MA-068/A24", "emisiones motores diésel (carbono elemental)", "https://www.insst.es/documents/94886/359043/MA_068_A24.pdf/a4ce71bb-45b9-cf6c-6dd4-d8da4e45c6db", []),
    ("MTA/MA-069/A25", "diisocianato de 2,4-tolueno (2,4 TDI)", "https://www.insst.es/documents/94886/359043/MA_069_A25.pdf/6a978606-b7b1-149c-fb23-2f464cdb7867", ["584-84-9"]),
    ("MTA/MA-070/A24", "diisocianato de 4,4'-difenilmetano (MDI)", "https://www.insst.es/documents/94886/359043/MA_070_A24.pdf/fd6ed31e-cc8d-56b7-4ec9-5fd53d18db0f", ["101-68-8"]),
    ("MTA/MA-071/A24", "diisocianato de 1,6-hexametileno (HDI)", "https://www.insst.es/documents/94886/359043/MA_071_A24.pdf/87205ac8-a690-e72f-7c51-b4173d17ee36", ["822-06-0"]),
]

def build_index():
    """Build a CAS → { mta_code, url, description } index."""
    index = {}
    for code, desc, url, cas_list in MTA_METHODS:
        for cas in cas_list:
            if cas not in index:
                index[cas] = []
            index[cas].append({
                "mta_code": code,
                "description": desc,
                "url": url
            })
    return index

if __name__ == "__main__":
    index = build_index()
    output_path = "public/mta_insst_index.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Generated {output_path}")
    print(f"   Total CAS entries: {len(index)}")
    print(f"   Total MTA methods: {len(MTA_METHODS)}")
    print(f"   CAS with methods: {sum(1 for v in index.values() if v)}")
