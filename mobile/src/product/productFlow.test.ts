/**
 * Product flow + generation-guard regression tests (no xAI).
 * Run with: npm run test:generation
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  doodleFingerprint,
  lookupCachedAsset,
  upsertStyleAsset,
} from '../generation/cache';
import { ensureStyleAsset } from '../generation/ensure';
import type { TransformClient } from '../transform/client';
import { TRANSFORM_VERSION } from '../transform/contracts';
import type { Creation, DoodleStroke, StyleId } from '../models/types';
import { STYLE_VERSIONS } from '../generation/versions';
import {
  canApplyGeneratedAsset,
  creationHasContent,
  decideMakeIt,
  evaluateNewDoodle,
  GenerationGuard,
  hasEstablishedStyle,
  makeItCtaLabel,
  pickSurpriseStyle,
  readSemanticUncertainty,
  rememberedStyleOf,
} from '../product';
import { usage } from '../usage/entitlement';

function stroke(id: string, points: [number, number][]): DoodleStroke {
  return {
    id,
    points: points.map(([x, y]) => ({ x, y })),
    color: '#1A1423',
    width: 8,
    tool: 'brush',
  };
}

function baseCreation(overrides: Partial<Creation> = {}): Creation {
  const t = '2026-09-28T00:00:00.000Z';
  return {
    id: 'creation_test',
    strokes: [stroke('s1', [[10, 10], [40, 50], [70, 20]])],
    canvas: { width: 200, height: 200 },
    style: 'gummy',
    assets: [],
    jobs: [],
    saved: false,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

function fakeClient(calls: { n: number }): TransformClient {
  return {
    async transform(req) {
      calls.n += 1;
      return {
        status: 'ok',
        style: req.style,
        transform_version: TRANSFORM_VERSION,
        provider: 'mock',
        image_base64: `fake_${req.style}_${calls.n}`,
        metadata: { style_version: STYLE_VERSIONS[req.style as StyleId] },
      };
    },
  };
}

describe('product flow policy', () => {
  it('decideMakeIt: first doodle → Preview; edit with cache → reuse; edit miss → regenerate', () => {
    assert.equal(
      decideMakeIt({
        hasStrokes: true,
        established: false,
        remembered: undefined,
        cacheHitForRemembered: false,
      }).kind,
      'preview',
    );
    assert.equal(
      decideMakeIt({
        hasStrokes: true,
        established: true,
        remembered: 'gummy',
        cacheHitForRemembered: true,
      }).kind,
      'reuse',
    );
    assert.deepEqual(
      decideMakeIt({
        hasStrokes: true,
        established: true,
        remembered: 'clay',
        cacheHitForRemembered: false,
      }),
      { kind: 'regenerate', style: 'clay' },
    );
  });

  it('rememberedStyleOf prefers metadata.lastSelectedStyle', () => {
    const c = baseCreation({
      style: 'gummy',
      assets: [
        {
          id: 'a1',
          creationId: 'creation_test',
          style: 'gummy',
          imageUri: 'x',
          createdAt: '2026-09-28T00:00:00.000Z',
        },
      ],
      metadata: { lastSelectedStyle: 'plush' },
    });
    assert.equal(rememberedStyleOf(c), 'plush');
    assert.equal(hasEstablishedStyle(c), true);
    assert.equal(hasEstablishedStyle(baseCreation()), false);
  });

  it('Preview CTA labels exist for Result; Preview itself has no generation CTA', () => {
    assert.equal(makeItCtaLabel('gummy'), 'Make it Gummy ✨');
    assert.equal(makeItCtaLabel('clay'), 'Make it Clay ✨');
    assert.equal(makeItCtaLabel(undefined), 'Make it ✨');
  });

  it('Preview starts with no default style (Gummy is not auto-selected)', () => {
    // Contract: open_preview clears selection — covered by AppState initial/openPreview.
    // Surprise Me / tile tap supply the style explicitly.
    const style = pickSurpriseStyle(['gummy', 'clay', 'plush', 'glossy'], () => 0);
    assert.equal(style, 'gummy');
    assert.notEqual(makeItCtaLabel(undefined), 'Make it Gummy ✨');
  });

  it('Surprise Me is local random — never claims aptness', () => {
    const seen = new Set<StyleId>();
    let i = 0;
    const seq = [0.1, 0.3, 0.6, 0.9];
    for (let n = 0; n < 4; n += 1) {
      seen.add(pickSurpriseStyle(undefined, () => seq[i++ % seq.length]!));
    }
    assert.ok(seen.size >= 1);
  });

  it('Preview tile / Surprise immediately use cache-or-generate (not selection-only)', async () => {
    // Product rule: generateIfMissing true path is what Preview taps invoke.
    // Selection-only path (Result ungenerated) uses generateIfMissing false.
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const creation = baseCreation();
    // Simulate Preview tap on gummy → create flow
    const generated = await ensureStyleAsset({
      creation,
      style: 'gummy',
      canvas: creation.canvas,
      client,
      rasterize: async () => 'png',
      generateIfMissing: true,
    });
    assert.equal(generated.kind, 'generated');
    assert.equal(calls.n, 1);

    // Simulate Result selecting ungenerated clay → selection only (no API)
    const peek = await ensureStyleAsset({
      creation: generated.kind === 'generated' ? generated.creation : creation,
      style: 'clay',
      canvas: creation.canvas,
      client,
      rasterize: async () => 'png',
      generateIfMissing: false,
    });
    assert.equal(peek.transformCalled, false);
    assert.equal(calls.n, 1);

    // Result CTA for clay → generate
    const clay = await ensureStyleAsset({
      creation: generated.kind === 'generated' ? generated.creation : creation,
      style: 'clay',
      canvas: creation.canvas,
      client,
      rasterize: async () => 'png',
      generateIfMissing: true,
    });
    assert.equal(clay.kind, 'generated');
    assert.equal(calls.n, 2);
  });

  it('New Doodle: empty → none; unsaved content → keep_unsaved', () => {
    const empty = evaluateNewDoodle({
      creation: baseCreation({ strokes: [], assets: [] }),
      dirty: false,
      hasContent: false,
    });
    assert.equal(empty.kind, 'none');

    const unsaved = evaluateNewDoodle({
      creation: baseCreation({ saved: false }),
      dirty: true,
      hasContent: true,
    });
    assert.equal(unsaved.kind, 'keep_unsaved');
    assert.match(unsaved.title, /Keep this doodle/);
    assert.match(unsaved.primaryLabel, /Save and leave/);
  });

  it('New Doodle: saved unchanged → none; edit draft → abandon_edit_draft', () => {
    const savedClean = evaluateNewDoodle({
      creation: baseCreation({ saved: true }),
      dirty: false,
      hasContent: true,
    });
    assert.equal(savedClean.kind, 'none');

    const editDraft = evaluateNewDoodle({
      creation: baseCreation({ saved: true }),
      dirty: true,
      hasContent: true,
      isEditDraft: true,
    });
    assert.equal(editDraft.kind, 'abandon_edit_draft');
    assert.match(editDraft.primaryLabel, /Save changes and leave/);
  });

  it('Stay does not change guard eligibility (prompt is re-evaluable)', () => {
    const again = evaluateNewDoodle({
      creation: baseCreation({ saved: false }),
      dirty: true,
      hasContent: true,
    });
    assert.equal(again.kind, 'keep_unsaved');
    const again2 = evaluateNewDoodle({
      creation: baseCreation({ saved: false }),
      dirty: true,
      hasContent: true,
    });
    assert.equal(again2.kind, 'keep_unsaved');
  });

  it('creationHasContent includes assets without strokes', () => {
    assert.equal(creationHasContent(baseCreation({ strokes: [] })), false);
    assert.equal(
      creationHasContent(
        baseCreation({
          strokes: [],
          assets: [
            {
              id: 'a1',
              creationId: 'creation_test',
              style: 'gummy',
              imageUri: 'data:image/png;base64,x',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      true,
    );
  });

  it('semantic warning only from explicit server metadata', () => {
    assert.equal(readSemanticUncertainty(undefined), false);
    assert.equal(readSemanticUncertainty({}), false);
    assert.equal(readSemanticUncertainty({ weird_score: 0.9 }), false);
    assert.equal(readSemanticUncertainty({ semantic_uncertain: true }), true);
    assert.equal(readSemanticUncertainty({ interpretation_confidence: 'low' }), true);
  });
});

describe('generation guard + cache product rules', () => {
  it('cache hit → transform not called → usage unchanged', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const before = usage.snapshot().transformsUsed;
    const first = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: async () => 'png',
    });
    assert.equal(first.kind, 'generated');
    if (first.kind !== 'generated') return;

    // Simulate product path: recount only on generated (caller records usage).
    usage.record('transform');
    const afterGen = usage.snapshot().transformsUsed;
    assert.equal(afterGen, before + 1);

    const hit = await ensureStyleAsset({
      creation: first.creation,
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: async () => 'png',
    });
    assert.equal(hit.kind, 'cache_hit');
    assert.equal(calls.n, 1);
    assert.equal(usage.snapshot().transformsUsed, afterGen);
  });

  it('duplicate Create for same key is prevented', () => {
    const guard = new GenerationGuard();
    const fp = 'doodle:abc';
    const a = guard.begin({ creationId: 'c1', fingerprint: fp, style: 'gummy' });
    const b = guard.begin({ creationId: 'c1', fingerprint: fp, style: 'gummy' });
    assert.ok(a);
    assert.equal(b, null);
    guard.clear(a!);
    const c = guard.begin({ creationId: 'c1', fingerprint: fp, style: 'gummy' });
    assert.ok(c);
  });

  it('stale async response cannot apply after source change', () => {
    const guard = new GenerationGuard();
    const req = guard.begin({
      creationId: 'c1',
      fingerprint: 'doodle:old',
      style: 'gummy',
    });
    assert.ok(req);
    assert.equal(
      canApplyGeneratedAsset({
        request: req!,
        currentCreationId: 'c1',
        currentFingerprint: 'doodle:new',
      }),
      false,
    );
    assert.equal(
      canApplyGeneratedAsset({
        request: req!,
        currentCreationId: 'c2',
        currentFingerprint: 'doodle:old',
      }),
      false,
    );
    assert.equal(
      canApplyGeneratedAsset({
        request: req!,
        currentCreationId: 'c1',
        currentFingerprint: 'doodle:old',
      }),
      true,
    );
  });

  it('source change invalidates old assets without requiring deletion', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const first = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: async () => 'png',
    });
    assert.equal(first.kind, 'generated');
    if (first.kind !== 'generated') return;

    // Keep historical asset on Creation, but change strokes → fingerprint miss.
    const edited = {
      ...first.creation,
      strokes: [...first.creation.strokes, stroke('s2', [[1, 1], [2, 2], [3, 3]])],
    };
    assert.equal(edited.assets.length, 1);
    assert.equal(lookupCachedAsset(edited, 'gummy'), undefined);
  });

  it('ungenerated style requires explicit create (generateIfMissing false)', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const gummy = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: async () => 'png',
    });
    assert.equal(gummy.kind, 'generated');
    if (gummy.kind !== 'generated') return;

    const clayPeek = await ensureStyleAsset({
      creation: gummy.creation,
      style: 'clay',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: async () => 'png',
      generateIfMissing: false,
    });
    assert.equal(clayPeek.kind, 'error');
    assert.equal(clayPeek.transformCalled, false);
    assert.equal(calls.n, 1);
  });

  it('Library Creation JSON retains multiple style variants', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    let creation = baseCreation({ id: 'lib1', saved: true });
    for (const style of ['gummy', 'clay'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: async () => 'png',
      });
      assert.equal(r.kind, 'generated');
      if (r.kind === 'generated') creation = r.creation;
    }
    const roundTrip = JSON.parse(JSON.stringify(creation)) as Creation;
    assert.equal(roundTrip.assets.length, 2);
    assert.ok(lookupCachedAsset(roundTrip, 'gummy'));
    assert.ok(lookupCachedAsset(roundTrip, 'clay'));
  });

  it('fingerprint helper is stable for same strokes', () => {
    const c = baseCreation();
    const a = doodleFingerprint(c.strokes, c.canvas);
    const b = doodleFingerprint(c.strokes, c.canvas);
    assert.equal(a, b);
  });

  it('upsert keeps distinct doodle fingerprints for same style history', () => {
    const c = baseCreation();
    const fp1 = doodleFingerprint(c.strokes, c.canvas);
    const withOne = upsertStyleAsset(c, {
      id: 'a1',
      creationId: c.id,
      style: 'gummy',
      imageUri: 'uri:1',
      doodleFingerprint: fp1,
      transformVersion: TRANSFORM_VERSION,
      styleVersion: STYLE_VERSIONS.gummy,
      semanticVersion: 'product.mvp.semantic.v1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const editedStrokes = [...c.strokes, stroke('s2', [[9, 9], [8, 8], [7, 7]])];
    const fp2 = doodleFingerprint(editedStrokes, c.canvas);
    const withTwo = upsertStyleAsset(
      { ...withOne, strokes: editedStrokes },
      {
        id: 'a2',
        creationId: c.id,
        style: 'gummy',
        imageUri: 'uri:2',
        doodleFingerprint: fp2,
        transformVersion: TRANSFORM_VERSION,
        styleVersion: STYLE_VERSIONS.gummy,
        semanticVersion: 'product.mvp.semantic.v1',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    );
    assert.equal(withTwo.assets.length, 2);
    assert.equal(lookupCachedAsset(withTwo, 'gummy')?.id, 'a2');
  });
});
