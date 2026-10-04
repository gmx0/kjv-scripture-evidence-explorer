import { createFileCorpusRepository } from "./corpus-repository.ts";
import { createStudyService } from "./study-service.ts";
import { createWordNetProvider } from "./wordnet-provider.ts";

let servicePromise: ReturnType<typeof loadService> | undefined;

export function getStudyService() {
  servicePromise ??= loadService();
  return servicePromise;
}

async function loadService() {
  const repository = await createFileCorpusRepository();
  return createStudyService(repository, createWordNetProvider());
}
