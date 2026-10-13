from pathlib import Path
from urllib.parse import quote
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(__file__).with_name("sitemap.xml")
BASE_URL = "https://www.houselearning.org/home/"
CONTENT_DIRECTORIES = ("math", "science", "computerscience", "blog", "games", "printables")
TOP_LEVEL_PAGES = (
    "math-page.html",
    "science-page.html",
    "computer-science-page.html",
    "blog.html",
    "games.html",
    "houselearning-for-mac.html",
)
SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"


def main():
    pages = {ROOT / "index.html"}
    pages.update(ROOT / path for path in TOP_LEVEL_PAGES)
    for directory in CONTENT_DIRECTORIES:
        pages.update((ROOT / directory).rglob("*.html"))

    locations = []
    for page in pages:
        if not page.is_file() or page.name.lower() == "404.html":
            continue
        relative_path = page.relative_to(ROOT).as_posix()
        if relative_path == "index.html":
            locations.append(BASE_URL)
        else:
            locations.append(BASE_URL + quote(relative_path, safe="/"))

    ET.register_namespace("", SITEMAP_NAMESPACE)
    urlset = ET.Element(f"{{{SITEMAP_NAMESPACE}}}urlset")
    for location in sorted(set(locations)):
        url = ET.SubElement(urlset, f"{{{SITEMAP_NAMESPACE}}}url")
        ET.SubElement(url, f"{{{SITEMAP_NAMESPACE}}}loc").text = location

    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="  ")
    tree.write(OUTPUT, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {len(set(locations))} URLs to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()