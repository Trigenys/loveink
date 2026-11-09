// Anti-plagiat (#20) : attribution ajoutee au copier, mention de droits, texte toujours indexable.
// Lancer : node --test tests/seo/attribution.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attributionFor, withAttribution } from '../../js/components/attribution.js';
import { build, normalize, storyPath } from '../../scripts/build-seo-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const stories = JSON.parse(readFileSync(join(ROOT, 'tests/seo/fixtures/stories.json'), 'utf8')).map((s) => normalize(s, s.id));
const src = { titre: "Les lettres d'août", auteur: 'Camille R.', url: 'https://loveink.site/histoires/x' };

test('attribution : titre, auteur, lien', () => {
    assert.equal(attributionFor(src), "Extrait de « Les lettres d'août », par Camille R., sur Love Ink : https://loveink.site/histoires/x");
    assert.equal(attributionFor({ url: 'u' }), 'Extrait de « Sans titre », sur Love Ink : u');
});

test('attribution : passage long annote, mot isole laisse tel quel', () => {
    const long = 'a'.repeat(120);
    assert.equal(withAttribution(long, src), `${long}\n\n${attributionFor(src)}`);
    assert.equal(withAttribution('juste un mot', src), null);
});

test('page histoire statique : conteneur annote, mention de droits, script charge, texte en clair', () => {
    const out = build(stories, { base: 'https://example.test', year: 2026 });
    const s = stories[0];
    const html = out.files.get(`${storyPath(s).slice(1)}.html`);
    assert.ok(html.includes(`data-li-attrib data-titre="Les lettres d&#39;août"`) || html.includes('data-li-attrib data-titre="Les lettres d'), 'conteneur annote');
    assert.ok(html.includes(`data-url="https://example.test${storyPath(s)}"`));
    assert.ok(html.includes('<script type="module" src="/js/components/attribution.js"></script>'));
    assert.match(html, /<p class="sp-rights">© 2026 Camille R\. · Tous droits réservés\./);
    assert.ok(html.includes('href="/conditions#plagiat"'));
    assert.ok(html.includes('Il avait laissé une lettre sous la pierre plate du jardin'), 'texte indexable intact');
});

test('CGU : ancre de procedure de retrait presente', () => {
    const cgu = readFileSync(join(ROOT, 'conditions.html'), 'utf8');
    assert.ok(cgu.includes('id="plagiat"'));
    assert.ok(cgu.includes('mailto:contact@loveink.site?subject=Signalement%20de%20plagiat'));
});
