const TEXT_REPLACEMENTS: Record<string, string> = {
  'GAN Latent Space Manifold': 'Adaptive Environment Curriculum',
  'GEN FOCUS & D(G(z))': 'REGRET FIT & NOVELTY',
  'Disc Score:': 'Challenge Fit:',
  'GEN PRIORITY:': 'CURRICULUM FIT:',
  'EPOCH': 'CYCLE',
  'G LOSS': 'CURR GAP',
  'D LOSS': 'REGRET GAP',
  'ACTIVE LATENT EMBEDDING (Z0..Z11)': 'ACTIVE ENVIRONMENT SEED (Z0..Z11)',
  '12-DIM MANIFOLD': '12-DIM PARAMETER SPACE',
};

let installed = false;

function relabel(root: ParentNode) {
  const section = root instanceof Element && root.id === 'gan-latent-grid-section'
    ? root
    : root.querySelector?.('#gan-latent-grid-section');
  if (!section) return;

  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const raw = node.textContent?.trim() || '';
    const replacement = TEXT_REPLACEMENTS[raw];
    if (replacement && node.textContent) {
      const leading = node.textContent.match(/^\s*/)?.[0] || '';
      const trailing = node.textContent.match(/\s*$/)?.[0] || '';
      node.textContent = `${leading}${replacement}${trailing}`;
    }
    node = walker.nextNode();
  }

  section.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
    const title = element.title;
    if (title.includes('GAN latent vector')) {
      element.title = title.replace('GAN latent vector', 'adaptive environment seed');
    }
    if (title.includes('GAN latent manifold')) {
      element.title = title.replace('GAN latent manifold', 'adaptive environment candidate space');
    }
  });
}

/**
 * Compatibility bridge while the Evolution panel still consumes legacy GANMetrics field names.
 * The underlying values are adaptive-curriculum metrics; this prevents the UI from claiming
 * discriminator/generator training that no longer happens.
 */
export function installCurriculumUiLabels() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) relabel(node);
      }
    }
    relabel(document);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(() => relabel(document));
}
