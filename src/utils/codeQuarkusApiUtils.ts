/**
 * Copyright 2021 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as http from "http";
import * as https from "https";
import * as yaml from "js-yaml";
import * as path from "path";
import { URL } from "url";
import { QuickPickItem } from "vscode";
import { QuarkusConfig } from "../QuarkusConfig";

/**
 * Represents the capabilities of a Code Quarkus API, such as code.quarkus.io/api or code.quarkus.redhat.com/api
 */
export interface CodeQuarkusFunctionality {
  /**
   * This Code Quarkus API supports the `ne=...` parameter to specify that example code should not be generated
   *
   * @deprecated the `ne=...` parameter will be removed in favour of the `nc=...` parameter
   */
  supportsNoExamplesParameter: boolean;
  /**
   * This Code Quarkus API supports the `nc=...` to specify that starter code should not be generated
   */
  supportsNoCodeParameter: boolean;
}

/**
 * Represents the the response object from the `/streams` endpoint from the Code Quarkus API
 */
 export interface PlatformVersionPickItem extends QuickPickItem {
  label: string;
  key: string;
  quarkusCoreVersion: string;
  recommended: boolean;
}

/**
 * Returns the capabilities of the Code Quarkus API instance that is defined in the user settings
 *
 * @returns the capabilities of the Code Quarkus API instance that is defined in the user settings
 * @throws if something goes wrong when getting the functionality from OpenAPI
 */
export async function getCodeQuarkusApiFunctionality(): Promise<CodeQuarkusFunctionality> {
  let openApiYaml: string;
  try {
    const newOpenApiUrl: string = path.dirname(QuarkusConfig.getApiUrl()) + '/q/openapi';
    openApiYaml = await fetch(newOpenApiUrl);
  } catch {
    const oldOpenApiUrl: string = path.dirname(QuarkusConfig.getApiUrl()) + '/openapi';
    openApiYaml = await fetch(oldOpenApiUrl);
  }
  const openApiData: any = yaml.load(openApiYaml);

  return {
    supportsNoExamplesParameter: openApiData?.paths?.['/api/download']?.get?.parameters?.filter(p => p?.name === 'ne').length > 0,
    supportsNoCodeParameter: openApiData?.paths?.['/api/download']?.get?.parameters?.filter(p => p?.name === 'nc').length > 0,
  } as CodeQuarkusFunctionality;
}

/**
 * Returns a set of capabilities that are implemented by all Code Quarkus APIs
 *
 * @returns a set of capabilities that are implemented by all Code Quarkus APIs
 */
export function getDefaultFunctionality() {
  return {
    supportsNoExamplesParameter: false,
    supportsNoCodeParameter: false,
  } as CodeQuarkusFunctionality;
}

/**
 * Returns the available platform(s) for a Quarkus project from Code Quarkus API
 *
 * @returns the available platform(s) for a Quarkus project from Code Quarkus API
 */
 export async function getCodeQuarkusApiPlatforms() {
    const platformApiRes = await fetch((QuarkusConfig.getApiUrl() + '/streams'));
    const availablePlatformsParsed = <Array<object>> yaml.load(platformApiRes);
    const availablePlatforms = availablePlatformsParsed.map(platform => {
      const version = `${platform["key"].split(":")[1]}${(platform["recommended"] ? ` (recommended)` : ``)}`;
      const cast: PlatformVersionPickItem = {
        label: version,
        key: platform["key"],
        quarkusCoreVersion: platform["quarkusCoreVersion"],
        recommended: platform["recommended"]
      };
      return cast;
    });
    return availablePlatforms;
  }

/**
 * Returns the GET response body if the code is 200 and rejects otherwise
 *
 * @param url URL to GET
 * @returns the response body if the code is 200 and rejects otherwise
 * @throws if anything goes wrong (not 200 response, any other errors during get)
 */
async function fetch(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res: http.IncomingMessage) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetch(new URL(url).origin + res.headers.location) //
          .then(resolve, reject);
      } else if (res.statusCode !== 200) {
        reject(`${url} returned status code ${res.statusCode}: ${res.statusMessage}`);
      } else {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf8');
        });
        res.on('end', () => {
          resolve(data);
        });
      }
    })
      .on('error', reject);
  });
}
