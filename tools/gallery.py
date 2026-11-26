#!/usr/bin/env python3
"""Dependency-free visual workflow renderer shared by the iOS and web catalogs.

Platform drivers own their capture registry, page copy and integrity gates.
Layouts are explicit editorial sequences; unknown captures remain visible.
"""

import html
from collections import Counter
from string import Template


def build_sections(manifest, layout):
    """Resolve presentation rows; retain all images and future capture workflows."""
    workflows = {item["id"]: item for item in manifest.get("workflows", [])}
    images = {item["id"]: item for item in manifest["screenshots"]}
    sections, used, sources, row_ids = [], set(), set(), set()
    for identifier, title, specifications in layout:
        rows = []
        for specification in specifications:
            source = specification["source"]
            if source not in workflows:
                continue
            names = specification.get("images")
            if names is None:
                names = specification["context"] + [item["id"] for item in manifest["screenshots"]
                                                    if item.get("workflow") == source]
            missing = set(names) - images.keys()
            if missing:
                raise ValueError("Missing gallery frames: " + ", ".join(sorted(missing)))
            if specification["id"] in row_ids:
                raise ValueError("Duplicate gallery row: " + specification["id"])
            row_ids.add(specification["id"])
            rows.append({"id": specification["id"], "title": specification.get("title", workflows[source].get("title", source)),
                         "source": source, "images": [images[name] for name in names]})
            used.update(names)
            sources.add(source)
        if rows:
            sections.append({"id": identifier, "title": title, "rows": rows})
    # New captures must never silently disappear if the editorial layout lags.
    additional = []
    for source, workflow in workflows.items():
        remaining = [item for item in manifest["screenshots"]
                     if item.get("workflow") == source and item["id"] not in used]
        if remaining or source not in sources:
            additional.append({"id": "additional-" + source, "title": workflow.get("title", source),
                               "source": source, "images": remaining})
            used.update(item["id"] for item in remaining)
    unassigned = [item for item in manifest["screenshots"] if item["id"] not in used]
    if unassigned:
        additional.append({"id": "additional-screens", "title": "Additional recorded screens",
                           "source": None, "images": unassigned})
    if additional:
        sections.append({"id": "additional", "title": "Additional recorded workflows", "rows": additional})
    return sections


def escape(value):
    return html.escape(str(value), quote=True)


def render_frame(item, number, reused):
    name, title, file = (escape(item[key]) for key in ("id", "title", "file"))
    try:
        width, height = int(item.get("width", 1206)), int(item.get("height", 2622))
    except (TypeError, ValueError) as error:
        raise ValueError("Invalid screenshot dimensions: " + name) from error
    if width <= 0 or height <= 0:
        raise ValueError("Screenshot dimensions must be positive: " + name)
    badge = '<span class="badge">Reused view</span>' if reused else ""
    return (f'<figure data-capture="{name}"><a href="{file}" target="_blank" rel="noopener" '
            f'aria-label="{title} — open original PNG in a new tab">'
            f'<img src="{file}" width="{width}" height="{height}" loading="lazy" decoding="async" alt="{title}"></a>'
            f'<figcaption><span class="frame-number">{number:02}</span> {title} {badge}'
            f'<code>{name}</code></figcaption></figure>')


def render_evidence(workflow):
    if not workflow:
        return ""
    actions = "".join(f'<li>{escape(step)}</li>' for step in workflow.get("steps", []))
    checks = "".join(f'<li>{escape(check)}</li>' for check in workflow.get("checks", []))
    error = f'<p class="issue">{escape(workflow["error"])}</p>' if workflow.get("error") else ""
    verified = f'<h4>Verified outcomes</h4><ul>{checks}</ul>' if checks else ""
    return (f'<details><summary>Source actions &amp; checks</summary><p>{escape(workflow["title"])} '
            '— the recorded run can cover several visual rows.</p>'
            f'<p>Capture status: <strong>{escape(workflow["status"])}</strong></p>'
            f'{error}<ol>{actions}</ol>{verified}</details>')


def render_row(row, workflows, issues, occurrences):
    identifier, title = escape(row["id"]), escape(row["title"])
    frames = "\n".join(render_frame(item, number, occurrences[item["id"]] > 1)
                       for number, item in enumerate(row["images"], 1))
    image_ids = {item["id"] for item in row["images"]}
    warnings = "".join(f'<p class="issue"><strong>Observed issue.</strong> {escape(issue["description"])}</p>'
                       for issue in issues if image_ids & set(issue["screenshots"]))
    search = " ".join([row["title"], *(item["title"] for item in row["images"])])
    return (f'<article class="workflow" id="{identifier}" data-search="{escape(search)}">'
            f'<div class="workflow-info"><h3><a href="#{identifier}">{title}</a></h3>'
            f'<p class="muted">{len(row["images"])} screens · left → right</p>{warnings}'
            f'{render_evidence(workflows.get(row["source"]))}</div>'
            f'<div class="frames" role="region" tabindex="0" aria-label="{title} — screenshots, scroll horizontally">'
            f'{frames}</div></article>')


def render_gallery_html(manifest, layout, page, frame_width=220, image_ratio="1206 / 2622"):
    """Use image_ratio=None to reserve each frame's intrinsic width/height ratio."""
    sections = build_sections(manifest, layout)
    rows = [row for section in sections for row in section["rows"]]
    occurrences = Counter(item["id"] for row in rows for item in row["images"])
    workflows = {item["id"]: item for item in manifest.get("workflows", [])}
    navigation, content = [], []
    for section in sections:
        identifier, title = escape(section["id"]), escape(section["title"])
        navigation.append(f'<a href="#section-{identifier}">{title}</a>')
        rendered_rows = "\n".join(render_row(row, workflows, manifest.get("knownIssues", []), occurrences)
                                  for row in section["rows"])
        content.append(f'<section class="area" id="section-{identifier}" aria-labelledby="heading-{identifier}">'
                       f'<h2 id="heading-{identifier}">{title} <span>{len(section["rows"])} workflows</span></h2>'
                       f'{rendered_rows}</section>')
    return Template(page).substitute(
        style=Template(STYLE).substitute(
            frame_width=frame_width,
            image_ratio_rule="" if image_ratio is None else f"aspect-ratio: {image_ratio}; "), script=SCRIPT,
        row_count=len(rows), image_count=len(manifest["screenshots"]), workflow_count=len(workflows),
        navigation="\n".join(navigation), content="\n".join(content))


STYLE = ''':root { color-scheme: dark; --frame-width: ${frame_width}px; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: #09090b; color: #fafafa; font: 15px/1.55 system-ui, sans-serif; }
a { color: #9bb5ff; text-underline-offset: 3px; }
a:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, .frames:focus-visible {
  outline: 3px solid #9bb5ff; outline-offset: 4px;
}
header, main, footer, .toolbar-inner { max-width: 1800px; margin: 0 auto; padding: 24px; }
header { padding-top: 48px; padding-bottom: 24px; }
h1 { margin: 0 0 12px; font-size: clamp(28px, 4vw, 42px); line-height: 1.2; letter-spacing: -0.025em; }
header p { max-width: 1000px; }
.eyebrow { color: #9bb5ff; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
.stats { font-variant-numeric: tabular-nums; font-weight: 600; }
.muted, footer { color: #a1a1aa; }
.toolbar { position: sticky; top: 0; z-index: 2; background: #18181b; border-block: 1px solid #2e2e33; }
.toolbar-inner { padding-block: 12px; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; }
nav { display: flex; flex-wrap: wrap; gap: 4px; flex: 1 1 660px; }
nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 6px 12px; border-radius: 8px; text-decoration: none; }
nav a:hover { background: #27272a; }
.controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
label { display: flex; gap: 8px; align-items: center; color: #a1a1aa; font-size: 13px; }
input, select { background: #09090b; border: 1px solid #52525b; border-radius: 8px; padding: 10px; color: #fafafa; font: inherit; min-height: 44px; }
input { width: 200px; max-width: 100%; }
#result-count { margin: 0; font-size: 13px; color: #a1a1aa; }
.area { margin-bottom: 64px; scroll-margin-top: 180px; }
h2 { font-size: 26px; margin: 12px 0 24px; border-bottom: 1px solid #2e2e33; padding-bottom: 16px; }
h2 span { color: #a1a1aa; font-size: 14px; font-weight: 400; margin-left: 12px; white-space: nowrap; }
.workflow { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; padding: 24px 0;
  border-bottom: 1px solid #2e2e33; scroll-margin-top: 180px; }
.workflow-info { min-width: 0; }
h3 { font-size: 18px; line-height: 1.4; margin: 0 0 12px; }
h3 a { color: #fafafa; text-decoration: none; }
h3 a:hover { color: #9bb5ff; text-decoration: underline; }
.workflow-info p { font-size: 13px; }
.frames { display: flex; gap: 20px; overflow-x: auto; overscroll-behavior-x: contain; padding: 4px 4px 20px;
  scrollbar-color: #71717a #18181b; scrollbar-width: auto; }
figure { flex: 0 0 min(var(--frame-width), calc(100vw - 48px)); width: min(var(--frame-width), calc(100vw - 48px)); margin: 0; }
figure > a { display: block; border: 1px solid #3f3f46; border-radius: 12px; overflow: hidden; background: #18181b; }
img { width: 100%; height: auto; ${image_ratio_rule}display: block; }
figcaption { margin-top: 12px; font-size: 13px; overflow-wrap: anywhere; }
.frame-number { color: #9bb5ff; font-weight: 700; font-variant-numeric: tabular-nums; margin-right: 4px; }
code { display: block; color: #a1a1aa; font-size: 11px; margin-top: 8px; overflow-wrap: anywhere; }
.badge { display: inline-block; margin-top: 6px; color: #b6c8ff; background: #1e2a4d; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
details { margin-top: 16px; color: #a1a1aa; font-size: 12px; }
summary { cursor: pointer; min-height: 44px; padding-block: 10px; color: #9bb5ff; }
details h4 { font-size: 13px; color: #fafafa; }
details ul, details ol { padding-left: 18px; }
details li { margin-block: 8px; }
.issue { color: #fbbf84; border: 1px solid #80552e; border-radius: 8px; padding: 12px; }
footer { border-top: 1px solid #2e2e33; }
@media (max-width: 800px) {
  header, main, footer, .toolbar-inner { padding-inline: 16px; }
  header { padding-top: 28px; }
  .toolbar-inner { gap: 8px; }
  nav { flex-basis: 100%; flex-wrap: nowrap; overflow-x: auto; }
  nav a { white-space: nowrap; }
  .controls { width: 100%; }
  .workflow { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .workflow-info details { max-width: 560px; }
  .workflow-info .muted { margin-bottom: 0; }
  .area, .workflow { scroll-margin-top: 210px; }
}'''

SCRIPT = '''const rows = Array.from(document.querySelectorAll('.workflow'));
const areas = Array.from(document.querySelectorAll('.area'));
const search = document.getElementById('workflow-search');
function filterWorkflows() {
  const terms = search.value.toLocaleLowerCase().trim().split(/\\s+/).filter(Boolean);
  let visible = 0;
  for (const row of rows) {
    const text = row.dataset.search.toLocaleLowerCase();
    row.hidden = !terms.every(term => text.includes(term));
    if (!row.hidden) visible += 1;
  }
  for (const area of areas) {
    area.hidden = !Array.from(area.querySelectorAll('.workflow')).some(row => !row.hidden);
    const link = document.querySelector('nav a[href="#' + area.id + '"]');
    if (link) link.hidden = area.hidden;
  }
  document.getElementById('no-results').hidden = visible !== 0;
  document.getElementById('result-count').textContent = 'Showing ' + visible + ' of ' + rows.length + ' workflows';
}
search.addEventListener('input', filterWorkflows);
document.getElementById('screen-size').addEventListener('change', event => {
  document.documentElement.style.setProperty('--frame-width', event.target.value + 'px');
});'''
