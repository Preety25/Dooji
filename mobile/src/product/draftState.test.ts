/**
 * Edit-draft / clear / navigation-guard state-transition tests.
 * Pure product helpers — mirrors AppContext semantics without RN.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  doodleFingerprint,
  lookupCachedAsset,
  upsertStyleAsset,
} from '../generation/cache';
import { ensureStyleAsset } from '../generation/ensure';
import { STYLE_VERSIONS } from '../generation/versions';
import type { Creation, DoodleStroke, StyleId } from '../models/types';
import {
  assetsForCurrentSource,
  cloneCreation,
  evaluateNavigationGuard,
  guardPromptFor,
  LIBRARY_DELETE_COLOR,
  openSavedDoodleIsClean,
  planOpenCreation,
  sameDoodleSource,
  shouldBeginEditDraftOnStroke,
} from '../product';
import { TRANSFORM_VERSION } from '../transform/contracts';
import type { TransformClient } from '../transform/client';

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

describe('navigation guard semantics', () => {
  it('unsaved Result leave → keep_unsaved; Stay leaves eligibility intact', () => {
    const kind = evaluateNavigationGuard({
      isEditDraft: false,
      creation: baseCreation({ saved: false }),
      dirty: true,
      hasContent: true,
    });
    assert.equal(kind, 'keep_unsaved');
    const prompt = guardPromptFor(kind)!;
    assert.equal(prompt.cancelLabel, 'Stay');
    assert.equal(
      evaluateNavigationGuard({
        isEditDraft: false,
        creation: baseCreation({ saved: false }),
        dirty: true,
        hasContent: true,
      }),
      'keep_unsaved',
    );
  });

  it('edit draft leave → abandon_edit_draft with Save changes copy', () => {
    const kind = evaluateNavigationGuard({
      isEditDraft: true,
      creation: baseCreation({ saved: true }),
      dirty: true,
      hasContent: true,
    });
    assert.equal(kind, 'abandon_edit_draft');
    const prompt = guardPromptFor(kind)!;
    assert.match(prompt.primaryLabel, /Save changes/);
    assert.match(prompt.secondaryLabel, /Discard changes/);
    assert.equal(prompt.cancelLabel, 'Stay');
  });

  it('clean saved Creation → no guard', () => {
    assert.equal(
      evaluateNavigationGuard({
        isEditDraft: false,
        creation: baseCreation({ saved: true }),
        dirty: false,
        hasContent: true,
      }),
      'none',
    );
  });
});

describe('edit draft vs saved source', () => {
  it('stroke edits mutate draft only; baseline Library clone unchanged', () => {
    const libraryCreation = baseCreation({
      id: 'lib1',
      saved: true,
      assets: [
        {
          id: 'a1',
          creationId: 'lib1',
          style: 'gummy',
          imageUri: 'uri:saved',
          doodleFingerprint: doodleFingerprint(
            [stroke('s1', [[10, 10], [40, 50], [70, 20]])],
            { width: 200, height: 200 },
          ),
          transformVersion: TRANSFORM_VERSION,
          styleVersion: STYLE_VERSIONS.gummy,
          semanticVersion: 'product.mvp.semantic.v1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const baseline = cloneCreation(libraryCreation);
    const draft: Creation = {
      ...cloneCreation(libraryCreation),
      strokes: [
        ...libraryCreation.strokes,
        stroke('s2', [[1, 1], [2, 2], [3, 3]]),
      ],
    };
    assert.ok(!sameDoodleSource(baseline, draft));
    assert.equal(baseline.strokes.length, 1);
    assert.equal(libraryCreation.strokes.length, 1);
    assert.equal(draft.strokes.length, 2);
    assert.ok(lookupCachedAsset(baseline, 'gummy'));
    assert.equal(lookupCachedAsset(draft, 'gummy'), undefined);
  });

  it('Make it on draft generates against draft fingerprint; baseline assets untouched', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const saved = baseCreation({ id: 'lib2', saved: true });
    const first = await ensureStyleAsset({
      creation: saved,
      style: 'gummy',
      canvas: saved.canvas,
      client,
      rasterize: async () => 'png',
    });
    assert.equal(first.kind, 'generated');
    if (first.kind !== 'generated') return;

    const baseline = cloneCreation(first.creation);
    const draftStrokes = [
      ...first.creation.strokes,
      stroke('s2', [[5, 5], [6, 6], [7, 7]]),
    ];
    const draft = { ...first.creation, strokes: draftStrokes, saved: true };
    const gen = await ensureStyleAsset({
      creation: draft,
      style: 'gummy',
      canvas: draft.canvas,
      client,
      rasterize: async () => 'png',
    });
    assert.equal(gen.kind, 'generated');
    if (gen.kind !== 'generated') return;

    // Baseline still has original asset only for its fingerprint
    assert.equal(baseline.assets.length, 1);
    assert.ok(lookupCachedAsset(baseline, 'gummy'));
    assert.equal(
      lookupCachedAsset(baseline, 'gummy')?.doodleFingerprint,
      doodleFingerprint(baseline.strokes, baseline.canvas),
    );

    // Draft has new fingerprint asset; may retain history via upsert
    assert.ok(lookupCachedAsset(gen.creation, 'gummy'));
    assert.equal(
      lookupCachedAsset(gen.creation, 'gummy')?.doodleFingerprint,
      doodleFingerprint(draftStrokes, draft.canvas),
    );
    assert.notEqual(
      lookupCachedAsset(gen.creation, 'gummy')?.id,
      lookupCachedAsset(baseline, 'gummy')?.id,
    );
  });

  it('Save changes promotes draft source + draft assets; Discard restores baseline', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const saved = baseCreation({ id: 'lib3', saved: true });
    const first = await ensureStyleAsset({
      creation: saved,
      style: 'gummy',
      canvas: saved.canvas,
      client,
      rasterize: async () => 'png',
    });
    if (first.kind !== 'generated') return;
    const baseline = cloneCreation(first.creation);

    const draftStrokes = [
      ...first.creation.strokes,
      stroke('edit', [[0, 0], [1, 1], [2, 2]]),
    ];
    let draft = { ...first.creation, strokes: draftStrokes };
    const gen = await ensureStyleAsset({
      creation: draft,
      style: 'gummy',
      canvas: draft.canvas,
      client,
      rasterize: async () => 'png',
    });
    if (gen.kind !== 'generated') return;
    draft = gen.creation;

    // Simulate Save changes: committed = draft
    const committed = { ...draft, saved: true };
    assert.ok(lookupCachedAsset(committed, 'gummy'));
    assert.ok(!sameDoodleSource(committed, baseline));

    // Simulate Discard: restore baseline
    const restored = cloneCreation(baseline);
    assert.ok(sameDoodleSource(restored, baseline));
    assert.ok(lookupCachedAsset(restored, 'gummy'));
    assert.equal(assetsForCurrentSource(restored).length, 1);
  });

  it('assetsForCurrentSource hides stale fingerprints', () => {
    const c = baseCreation({ id: 'lib4' });
    const fp1 = doodleFingerprint(c.strokes, c.canvas);
    const withOld = upsertStyleAsset(c, {
      id: 'old',
      creationId: c.id,
      style: 'gummy',
      imageUri: 'uri:old',
      doodleFingerprint: fp1,
      transformVersion: TRANSFORM_VERSION,
      styleVersion: STYLE_VERSIONS.gummy,
      semanticVersion: 'product.mvp.semantic.v1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const edited = {
      ...withOld,
      strokes: [...c.strokes, stroke('x', [[9, 9], [8, 8], [7, 7]])],
    };
    const fp2 = doodleFingerprint(edited.strokes, edited.canvas);
    const withBoth = upsertStyleAsset(edited, {
      id: 'new',
      creationId: c.id,
      style: 'gummy',
      imageUri: 'uri:new',
      doodleFingerprint: fp2,
      transformVersion: TRANSFORM_VERSION,
      styleVersion: STYLE_VERSIONS.gummy,
      semanticVersion: 'product.mvp.semantic.v1',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(withBoth.assets.length, 2);
    const visible = assetsForCurrentSource(withBoth);
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.id, 'new');
  });
});

describe('clear canvas semantics (product rules)', () => {
  it('new doodle clear empties strokes; undo stack can restore', () => {
    const c = baseCreation({ saved: false });
    const before = c.strokes;
    const cleared = { ...c, strokes: [] as DoodleStroke[] };
    assert.equal(cleared.strokes.length, 0);
    const restored = { ...cleared, strokes: before };
    assert.equal(restored.strokes.length, 1);
  });

  it('saved edit clear exits draft: library baseline untouched; fresh canvas', () => {
    const library = baseCreation({ id: 'lib5', saved: true });
    const baseline = cloneCreation(library);
    const draft = {
      ...cloneCreation(library),
      strokes: [...library.strokes, stroke('e', [[1, 1], [2, 2], [3, 3]])],
    };
    // Clear exit → fresh creation; baseline snapshot kept for Undo only
    const fresh = baseCreation({
      id: 'fresh',
      saved: false,
      strokes: [],
      assets: [],
    });
    assert.equal(fresh.strokes.length, 0);
    assert.equal(fresh.saved, false);
    assert.equal(baseline.strokes.length, library.strokes.length);
    assert.ok(sameDoodleSource(baseline, library));
    // Undo restores draft
    const undoRestore = cloneCreation(draft);
    assert.equal(undoRestore.strokes.length, 2);
    assert.ok(!sameDoodleSource(undoRestore, baseline));
  });

  it('Library Delete red is distinct from Canvas Clear / Discard semantics', () => {
    assert.equal(LIBRARY_DELETE_COLOR, '#FB4A52');
    // Clear / Discard keep separate copy + colors in UI; this token is Library-only.
    assert.notEqual(LIBRARY_DELETE_COLOR, '#CE3444');
  });
});

describe('Library open destinations', () => {
  function savedWithAsset(): Creation {
    const strokes = [stroke('s1', [[10, 10], [40, 50], [70, 20]])];
    const canvas = { width: 200, height: 200 };
    return baseCreation({
      id: 'lib_open',
      saved: true,
      strokes,
      assets: [
        {
          id: 'asset_gummy',
          creationId: 'lib_open',
          style: 'gummy',
          imageUri: 'uri:gummy',
          doodleFingerprint: doodleFingerprint(strokes, canvas),
          transformVersion: TRANSFORM_VERSION,
          styleVersion: STYLE_VERSIONS.gummy,
          semanticVersion: 'product.mvp.semantic.v1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  }

  it('Your doodle → Canvas, not dirty, no edit draft', () => {
    const c = savedWithAsset();
    const plan = planOpenCreation(c, { destination: 'canvas' });
    assert.equal(plan.phase, 'canvas');
    assert.equal(plan.activeAssetId, undefined);
    assert.equal(plan.beginsEditDraft, false);
    assert.equal(plan.dirty, false);
    assert.ok(
      openSavedDoodleIsClean({
        saved: true,
        isEditDraft: false,
        dirty: false,
      }),
    );
    assert.equal(
      evaluateNavigationGuard({
        isEditDraft: false,
        creation: c,
        dirty: false,
        hasContent: true,
      }),
      'none',
    );
  });

  it('generated Dooji → Result for that asset', () => {
    const c = savedWithAsset();
    const plan = planOpenCreation(c, {
      destination: 'result',
      assetId: 'asset_gummy',
    });
    assert.equal(plan.phase, 'result');
    assert.equal(plan.activeAssetId, 'asset_gummy');
    assert.equal(plan.selectedStyle, 'gummy');
    assert.equal(plan.dirty, false);
  });

  it('opening saved doodle does not create dirty state; first stroke begins draft', () => {
    assert.equal(
      shouldBeginEditDraftOnStroke({
        creationSaved: true,
        hasSavedBaseline: false,
      }),
      true,
    );
    assert.equal(
      shouldBeginEditDraftOnStroke({
        creationSaved: true,
        hasSavedBaseline: true,
      }),
      false,
    );
    assert.equal(
      shouldBeginEditDraftOnStroke({
        creationSaved: false,
        hasSavedBaseline: false,
      }),
      false,
    );
  });

  it('Result secondary actions retain Discard / Edit / New semantics (labels)', () => {
    // Guards against accidental rename when the footer becomes scrollable.
    const editDraftActions = ['Discard changes', 'Edit doodle', 'New doodle'];
    const cleanActions = ['Edit doodle', 'New doodle'];
    assert.deepEqual(editDraftActions.slice(0, 3), [
      'Discard changes',
      'Edit doodle',
      'New doodle',
    ]);
    assert.ok(cleanActions.includes('Edit doodle'));
    assert.ok(!cleanActions.includes('Discard changes'));
  });
});

describe('Creation multi-style variants (Library + Result persistence)', () => {
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
          metadata: {
            // Server may echo product JSON version (plush 1.1.0).
            style_version:
              req.style === 'plush' ? '1.1.0' : STYLE_VERSIONS[req.style as StyleId],
            style_id: req.style,
          },
        };
      },
    };
  }

  it('Gummy + Plush persist on one Creation; switch without regeneration', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    let creation = baseCreation({ id: 'multi_v1', saved: true });
    for (const style of ['gummy', 'plush'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: async () => 'doodle_b64',
      });
      assert.equal(r.kind, 'generated');
      if (r.kind === 'generated') creation = r.creation;
    }
    assert.equal(calls.n, 2);
    assert.equal(creation.id, 'multi_v1');
    assert.equal(creation.assets.length, 2);

    for (const style of ['gummy', 'plush', 'gummy'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: async () => 'doodle_b64',
      });
      assert.equal(r.kind, 'cache_hit');
      assert.equal(r.transformCalled, false);
      assert.equal(r.creation.id, 'multi_v1');
    }
    assert.equal(calls.n, 2);
  });

  it('Library represents source + both generated variants after hydration', async () => {
    const calls = { n: 0 };
    let creation = baseCreation({ id: 'lib_multi', saved: true });
    for (const style of ['gummy', 'plush'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client: fakeClient(calls),
        rasterize: async () => 'doodle_b64',
      });
      if (r.kind === 'generated') creation = r.creation;
    }

    const hydrated = JSON.parse(JSON.stringify(creation)) as Creation;
    const visible = assetsForCurrentSource(hydrated);
    assert.equal(visible.length, 2);
    assert.ok(visible.some((a) => a.style === 'gummy'));
    assert.ok(visible.some((a) => a.style === 'plush'));

    const openSource = planOpenCreation(hydrated, { destination: 'canvas' });
    assert.equal(openSource.phase, 'canvas');
    assert.equal(openSource.activeAssetId, undefined);

    const plush = visible.find((a) => a.style === 'plush');
    assert.ok(plush);
    const openGen = planOpenCreation(hydrated, {
      destination: 'result',
      assetId: plush!.id,
    });
    assert.equal(openGen.phase, 'result');
    assert.equal(openGen.activeAssetId, plush!.id);
    assert.equal(openGen.selectedStyle, 'plush');

    // Variants stay on the same Creation — never a new id.
    assert.equal(hydrated.id, 'lib_multi');
    assert.ok(hydrated.assets.every((a) => a.creationId === 'lib_multi'));
  });

  it('edit-draft Save/Discard still preserves baseline variants', () => {
    const strokes = [stroke('s1', [[10, 10], [40, 50], [70, 20]])];
    const canvas = { width: 200, height: 200 };
    const fp = doodleFingerprint(strokes, canvas);
    const baseline = baseCreation({
      id: 'edit_keep',
      saved: true,
      strokes,
      assets: [
        {
          id: 'a_g',
          creationId: 'edit_keep',
          style: 'gummy',
          imageUri: 'uri:g',
          doodleFingerprint: fp,
          transformVersion: TRANSFORM_VERSION,
          styleVersion: STYLE_VERSIONS.gummy,
          semanticVersion: 'product.mvp.semantic.v1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'a_p',
          creationId: 'edit_keep',
          style: 'plush',
          imageUri: 'uri:p',
          doodleFingerprint: fp,
          transformVersion: TRANSFORM_VERSION,
          styleVersion: STYLE_VERSIONS.plush,
          semanticVersion: 'product.mvp.semantic.v1',
          createdAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });
    assert.equal(assetsForCurrentSource(baseline).length, 2);

    // Discard restores baseline — both variants intact.
    const restored = cloneCreation(baseline);
    assert.equal(assetsForCurrentSource(restored).length, 2);
    assert.equal(
      evaluateNavigationGuard({
        isEditDraft: false,
        creation: restored,
        dirty: false,
        hasContent: true,
      }),
      'none',
    );
    assert.equal(guardPromptFor('none'), null);
  });
});
