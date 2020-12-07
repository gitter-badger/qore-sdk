import { AxiosRequestConfig } from "axios";
import Wonka from "wonka";
import QoreClient from "./client/Qore";

export type NetworkPolicy = "network-only" | "network-and-cache" | "cache-only";

export type QoreOperationConfig = {
  networkPolicy: NetworkPolicy;
  pollInterval: number;
};

export type QoreOperation<
  Params extends AxiosRequestConfig = AxiosRequestConfig
> = QoreOperationConfig & {
  request: Params;
  type: Params["method"] | "teardown";
  key: string;
  meta: Record<string, any>;
};

export type QoreOperationResultData<T> = T extends QoreOperationResult<
  AxiosRequestConfig,
  infer U
>
  ? U
  : never;

export type QoreOperationResult<Params = AxiosRequestConfig, Data = any> = {
  operation: QoreOperation<Params>;
  data?: Data;
  error?: Error;
  stale: boolean;
};

/** Input parameters for to an Exchange factory function. */
export interface ExchangeInput {
  client: QoreClient<{}>;
  forward: ExchangeIO;
}

export type Exchange = (input: ExchangeInput) => ExchangeIO;

export type ExchangeIO = (
  ops$: Wonka.Source<QoreOperation<AxiosRequestConfig>>
) => Wonka.Source<QoreOperationResult<AxiosRequestConfig>>;
