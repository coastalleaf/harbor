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

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const queryUrl = url.searchParams.get('url');
		const strategy = url.searchParams.get('strategy') || 'mobile'; // Default to mobile if not specified

		if (!queryUrl) {
			return new Response(
				JSON.stringify({
					error: 'Please provide a valid url query parameter.',
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const apiKey = 'AIzaSyB5M1JILkVV4dzmVHzsvfBKYrfoJbkYgcQ'; // Replace with your API key
		const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
			queryUrl,
		)}&strategy=${strategy}&category=performance&key=${apiKey}`;

		try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				return new Response(
					JSON.stringify({
						error: 'Failed to fetch data from Google PageSpeed Insights API.',
					}),
					{ status: response.status, headers: { 'Content-Type': 'application/json' } },
				);
			}

			const data: any = await response.json();
			const performanceCategory = data.lighthouseResult.categories.performance;
			const audits = data.lighthouseResult.audits;

			const metrics = {
				firstContentfulPaint: audits['first-contentful-paint']?.displayValue,
				largestContentfulPaint: audits['largest-contentful-paint']?.displayValue,
				totalBlockingTime: audits['total-blocking-time']?.displayValue,
				cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue,
				speedIndex: audits['speed-index']?.displayValue,
			};

			const recommendations = Object.values(audits)
				.filter((audit: any) => audit.score !== 1 && audit.scoreDisplayMode === 'metricSavings')
				.map((audit: any) => ({
					title: audit.title,
					description: audit.description,
					displayValue: audit.displayValue,
					score: audit.score,
				}));

			const result = {
				requestedUrl: data.lighthouseResult.requestedUrl,
				finalUrl: data.lighthouseResult.finalUrl,
				overallScore: performanceCategory.score * 100, // Score is between 0 and 1
				metrics,
				recommendations,
			};

			return new Response(JSON.stringify(result, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(JSON.stringify({ error: 'Internal error occurred.', details: error.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
} satisfies ExportedHandler<Env>;
