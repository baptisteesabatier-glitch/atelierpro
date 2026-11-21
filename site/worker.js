/**
 * AtelierPro — worker de service des assets statiques.
 * Le SPA est prérendu par Vite dans ./dist ; le routage client est géré
 * par la fonctionnalité `spa` du manifeste (repli vers index.html).
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
