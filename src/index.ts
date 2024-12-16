/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	API_KEY: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const queryUrl = url.searchParams.get('url');

		if (!queryUrl) {
			return new Response(
				JSON.stringify({
					error: 'Please provide a valid url query parameter.',
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
		const strategies = ['mobile', 'desktop']; // Analyze both mobile and desktop

		const results: any = {};

		try {
			for (const strategy of strategies) {
				results[strategy] = {};

				for (const category of categories) {
					const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
						queryUrl,
					)}&strategy=${strategy}&category=${category}&key=${env.API_KEY}`;

					const response = await fetch(apiUrl);

					if (!response.ok) {
						results[strategy][category] = {
							error: `Failed to fetch data for ${category} (${strategy}).`,
						};
						continue;
					}

					const data: any = await response.json();
					const audits = data.lighthouseResult.audits;

					// Collect metrics only for the "performance" category
					const metrics =
						category === 'performance'
							? {
									firstContentfulPaint: audits['first-contentful-paint']?.displayValue,
									largestContentfulPaint: audits['largest-contentful-paint']?.displayValue,
									totalBlockingTime: audits['total-blocking-time']?.displayValue,
									cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue,
									speedIndex: audits['speed-index']?.displayValue,
								}
							: undefined;

					// Collect recommendations
					const recommendations = Object.values(audits)
						.filter(
							(audit: any) => audit.score !== 1 && (audit.scoreDisplayMode === 'metricSavings' || audit.scoreDisplayMode === 'binary'),
						)
						.map((audit: any) => ({
							title: audit.title,
							description: audit.description,
							displayValue: audit.displayValue,
							score: audit.score,
						}));

					results[strategy][category] = {
						requestedUrl: data.lighthouseResult.requestedUrl,
						finalUrl: data.lighthouseResult.finalUrl,
						overallScore: data.lighthouseResult.categories[category]?.score * 100, // Convert score to percentage
						metrics: metrics,
						recommendations: recommendations,
					};
				}
			}

			return new Response(JSON.stringify(results, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(
				JSON.stringify({
					error: 'Internal error occurred.',
					details: error.message,
				}),
				{ status: 500, headers: { 'Content-Type': 'application/json' } },
			);
		}
	},
} satisfies ExportedHandler<Env>;
