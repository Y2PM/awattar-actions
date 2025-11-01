interface FetchDataInput {
  start: string | undefined;
  end: string | undefined;
}
export default async (payload: FetchDataInput) => {
  // Best Practice: Separate Base URL of the Service and the targetURL of the API
  const baseUrl = 'https://api.awattar.de';
  const apiEndpoint = '/v1/marketdata';
  // re-construct the URL using the built-in URL
  const targetUrl = new URL(apiEndpoint, baseUrl);
  // add query parameters for start and end (if they are defined)
  if (payload.start) {
    targetUrl.searchParams.append('start', payload.start);
  }
  if (payload.end) {
    targetUrl.searchParams.append('end', payload.end);
  }
  // use fetch to call the API
  return await fetch(targetUrl.toString())
    .then((response) => response.json());
};