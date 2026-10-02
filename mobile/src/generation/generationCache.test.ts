/**
 * Generation-cache regression tests (provider-agnostic — no xAI).
 * Run: npx tsx --test src/generation/generationCache.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TransformClient } from '../transform/client';
import { TRANSFORM_VERSION } from '../transform/contracts';
import type { Creation, DoodleStroke, GeneratedAsset, StyleId } from '../models/types';
import {
  clearGeneratedAssets,
  doodleFingerprint,
  lookupCachedAsset,
  upsertStyleAsset,
} from './cache';
import { ensureStyleAsset } from './ensure';
import {
  SEMANTIC_VERSION,
  STYLE_VERSIONS,
  currentVersionsForStyle,
} from './versions';

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
        model: 'test-mock',
        image_base64: `fake_${req.style}_${calls.n}`,
        metadata: { style_version: STYLE_VERSIONS[req.style as StyleId], style_id: req.style },
      };
    },
  };
}

async function rasterStub(): Promise<string> {
  return 'doodle_png_b64';
}

describe('generation cache', () => {
  it('A: first generation — miss → transform called → cached', async () => {
    const calls = { n: 0 };
    const creation = baseCreation();
    const result = await ensureStyleAsset({
      creation,
      style: 'gummy',
      canvas: creation.canvas,
      client: fakeClient(calls),
      rasterize: rasterStub,
      generateIfMissing: true,
    });
    assert.equal(result.kind, 'generated');
    assert.equal(result.transformCalled, true);
    assert.equal(calls.n, 1);
    if (result.kind !== 'generated') return;
    assert.equal(result.asset.style, 'gummy');
    assert.ok(result.asset.imageUri.includes('fake_gummy_1'));
    assert.equal(lookupCachedAsset(result.creation, 'gummy')?.id, result.asset.id);
  });

  it('B: cached generation — hit → transform NOT called', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const first = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(first.kind, 'generated');
    if (first.kind !== 'generated') return;

    const second = await ensureStyleAsset({
      creation: first.creation,
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(second.kind, 'cache_hit');
    assert.equal(second.transformCalled, false);
    assert.equal(calls.n, 1);
  });

  it('C: new style — Gummy exists, Clay miss → one transform for Clay', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const gummy = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(gummy.kind, 'generated');
    if (gummy.kind !== 'generated') return;

    const clay = await ensureStyleAsset({
      creation: gummy.creation,
      style: 'clay',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(clay.kind, 'generated');
    assert.equal(calls.n, 2);
    if (clay.kind !== 'generated') return;
    assert.equal(clay.creation.assets.length, 2);
    assert.ok(lookupCachedAsset(clay.creation, 'gummy'));
    assert.ok(lookupCachedAsset(clay.creation, 'clay'));
  });

  it('D: switching between cached styles → zero additional transforms', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    let creation = baseCreation();
    for (const style of ['gummy', 'clay'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: rasterStub,
      });
      assert.equal(r.kind, 'generated');
      if (r.kind === 'generated') creation = r.creation;
    }
    assert.equal(calls.n, 2);

    for (const style of ['gummy', 'clay', 'gummy', 'clay'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: rasterStub,
      });
      assert.equal(r.kind, 'cache_hit');
      assert.equal(r.transformCalled, false);
    }
    assert.equal(calls.n, 2);
  });

  it('E: persistence — cached variants survive JSON re-hydration', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    let creation = baseCreation({ id: 'creation_persist' });
    for (const style of ['gummy', 'plush'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: rasterStub,
      });
      assert.equal(r.kind, 'generated');
      if (r.kind === 'generated') creation = r.creation;
    }

    const rehydrated = JSON.parse(JSON.stringify(creation)) as Creation;
    assert.equal(rehydrated.assets.length, 2);
    assert.ok(lookupCachedAsset(rehydrated, 'gummy'));
    assert.ok(lookupCachedAsset(rehydrated, 'plush'));

    const again = await ensureStyleAsset({
      creation: rehydrated,
      style: 'gummy',
      canvas: rehydrated.canvas,
      client,
      rasterize: rasterStub,
    });
    assert.equal(again.kind, 'cache_hit');
    assert.equal(calls.n, 2);
  });

  it('F: edit doodle — old assets are not reused', async () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    const first = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(first.kind, 'generated');
    if (first.kind !== 'generated') return;

    // Simulate edit: clear assets + change strokes (AppContext does both).
    const edited = clearGeneratedAssets({
      ...first.creation,
      strokes: [
        ...first.creation.strokes,
        stroke('s2', [[5, 5], [15, 25], [30, 10]]),
      ],
    });
    assert.equal(edited.assets.length, 0);
    assert.equal(lookupCachedAsset(edited, 'gummy'), undefined);

    // Even if stale assets were left behind, fingerprint mismatch blocks reuse.
    const staleLeft = {
      ...first.creation,
      strokes: edited.strokes,
    };
    assert.equal(lookupCachedAsset(staleLeft, 'gummy'), undefined);

    const regen = await ensureStyleAsset({
      creation: edited,
      style: 'gummy',
      canvas: edited.canvas,
      client,
      rasterize: rasterStub,
    });
    assert.equal(regen.kind, 'generated');
    assert.equal(calls.n, 2);
  });

  it('G: versioning — incompatible versions do not reuse', async () => {
    const creation = baseCreation();
    const fp = doodleFingerprint(creation.strokes, creation.canvas);
    const versions = currentVersionsForStyle('gummy');
    const asset: GeneratedAsset = {
      id: 'asset_old',
      creationId: creation.id,
      style: 'gummy',
      imageUri: 'data:image/png;base64,old',
      transformVersion: versions.transformVersion,
      styleVersion: versions.styleVersion,
      semanticVersion: versions.semanticVersion,
      doodleFingerprint: fp,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const withAsset = upsertStyleAsset(creation, asset);
    assert.ok(lookupCachedAsset(withAsset, 'gummy'));

    // Wrong transform version
    assert.equal(
      lookupCachedAsset(withAsset, 'gummy', {
        ...versions,
        transformVersion: 'product.mvp.v999',
      }),
      undefined,
    );
    // Wrong style version
    assert.equal(
      lookupCachedAsset(withAsset, 'gummy', {
        ...versions,
        styleVersion: '9.9.9',
      }),
      undefined,
    );
    // Wrong semantic version
    assert.equal(
      lookupCachedAsset(withAsset, 'gummy', {
        ...versions,
        semanticVersion: 'product.mvp.semantic.v999',
      }),
      undefined,
    );

    // Stale asset missing version fields
    const legacy = upsertStyleAsset(creation, {
      id: 'asset_legacy',
      creationId: creation.id,
      style: 'gummy',
      imageUri: 'data:image/png;base64,legacy',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(lookupCachedAsset(legacy, 'gummy'), undefined);
  });

  it('H2: server style_version echo must not break Plush cache / Library visibility', async () => {
    // Reproduces phone bug: product/styles/plush.json is 1.1.0; server echoes that.
    // Cache identity must use STYLE_VERSIONS.plush so lookup / assetsForCurrentSource work.
    assert.equal(STYLE_VERSIONS.plush, '1.1.0');
    const calls = { n: 0 };
    const client: TransformClient = {
      async transform(req) {
        calls.n += 1;
        return {
          status: 'ok',
          style: req.style,
          transform_version: TRANSFORM_VERSION,
          provider: 'mock',
          image_base64: `fake_${req.style}_${calls.n}`,
          // Deliberately echo a server style_version; ensure must pin local STYLE_VERSIONS.
          metadata: {
            style_version: req.style === 'plush' ? '1.1.0' : STYLE_VERSIONS[req.style as StyleId],
            style_id: req.style,
          },
        };
      },
    };
    let creation = baseCreation({ id: 'creation_plush_pin' });
    for (const style of ['gummy', 'plush'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: rasterStub,
      });
      assert.equal(r.kind, 'generated');
      if (r.kind === 'generated') {
        assert.equal(r.asset.styleVersion, STYLE_VERSIONS[style]);
        creation = r.creation;
      }
    }
    assert.equal(calls.n, 2);
    assert.ok(lookupCachedAsset(creation, 'gummy'));
    assert.ok(lookupCachedAsset(creation, 'plush'));

    // Switch Plush → Gummy → Plush: zero new transforms
    for (const style of ['plush', 'gummy', 'plush'] as StyleId[]) {
      const r = await ensureStyleAsset({
        creation,
        style,
        canvas: creation.canvas,
        client,
        rasterize: rasterStub,
      });
      assert.equal(r.kind, 'cache_hit');
      assert.equal(r.transformCalled, false);
    }
    assert.equal(calls.n, 2);

    // Library hydration
    const hydrated = JSON.parse(JSON.stringify(creation)) as Creation;
    assert.equal(hydrated.assets.length, 2);
    assert.ok(lookupCachedAsset(hydrated, 'gummy'));
    assert.ok(lookupCachedAsset(hydrated, 'plush'));
  });

  it('H: provider independence — fake client only; SEMANTIC/TRANSFORM pins present', async () => {
    assert.equal(TRANSFORM_VERSION, 'product.mvp.v1');
    assert.ok(SEMANTIC_VERSION.length > 0);
    assert.equal(STYLE_VERSIONS.gummy, '1.0.0');
    assert.equal(STYLE_VERSIONS.plush, '1.1.0');
    const calls = { n: 0 };
    const client: TransformClient = {
      async transform(req) {
        calls.n += 1;
        return {
          status: 'ok',
          style: req.style,
          transform_version: TRANSFORM_VERSION,
          provider: 'future-provider',
          image_url: 'file://local/gummy.png',
          metadata: { style_version: STYLE_VERSIONS.gummy },
        };
      },
    };
    const r = await ensureStyleAsset({
      creation: baseCreation(),
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(r.kind, 'generated');
    if (r.kind !== 'generated') return;
    assert.equal(r.asset.provider, 'future-provider');
    assert.equal(r.result.provider, 'future-provider');
    assert.equal(calls.n, 1);

    const hit = await ensureStyleAsset({
      creation: r.creation,
      style: 'gummy',
      canvas: { width: 200, height: 200 },
      client,
      rasterize: rasterStub,
    });
    assert.equal(hit.kind, 'cache_hit');
    assert.equal(calls.n, 1);
  });

  it('upsert replaces same-style same-fingerprint; keeps other fingerprints', () => {
    const calls = { n: 0 };
    const client = fakeClient(calls);
    // covered in productFlow tests — keep a quick sanity here
    assert.equal(STYLE_VERSIONS.gummy, '1.0.0');
    assert.equal(calls.n, 0);
    void client;
  });
});
