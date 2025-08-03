let lastRequest: Promise<any> = Promise.resolve();

export async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const execute = async () => {
    const response = await fetch(url, options);
    // wait 2 seconds after each request before allowing the next
    await new Promise(resolve => setTimeout(resolve, 2000));
    return response;
  };

  const result = lastRequest.then(execute);
  // swallow errors to keep chain alive for subsequent calls
  lastRequest = result.catch(() => {});
  return result;
}
