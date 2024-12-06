import { Client as _Client } from "https://deno.land/x/postgres/mod.ts";
import type { Client as ClientInterface } from "../../types/index.d.ts";

export class Client implements ClientInterface
{
  private proxy: _Client;

  constructor(uri: string) {
    this.proxy = new _Client(uri)
  }

  async connect(): Promise<void> {
    return await this.proxy.connect();
  }

  async end(): Promise<void> {
    return await this.proxy.end();
  }

  async query(query: string, args?: any[]): Promise<any> {
    return await this.proxy.query(query, args);
  }
}

