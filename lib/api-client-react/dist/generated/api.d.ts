import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { EtoRow, FuelSummary, HealthStatus, ProvinceRow, UploadFuelExcelBody, UploadResult, VehicleRow } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * Returns server health status
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Returns key KPIs from PM Dashboard sheet
 * @summary Get top-level fuel subsidy summary
 */
export declare const getGetFuelSummaryUrl: () => string;
export declare const getFuelSummary: (options?: RequestInit) => Promise<FuelSummary>;
export declare const getGetFuelSummaryQueryKey: () => readonly ["/api/fuel/summary"];
export declare const getGetFuelSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getFuelSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFuelSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFuelSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getFuelSummary>>>;
export type GetFuelSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get top-level fuel subsidy summary
 */
export declare function useGetFuelSummary<TData = Awaited<ReturnType<typeof getFuelSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Returns province-wise overview table data
 * @summary Get province-wise breakdown
 */
export declare const getGetFuelProvinceOverviewUrl: () => string;
export declare const getFuelProvinceOverview: (options?: RequestInit) => Promise<ProvinceRow[]>;
export declare const getGetFuelProvinceOverviewQueryKey: () => readonly ["/api/fuel/province-overview"];
export declare const getGetFuelProvinceOverviewQueryOptions: <TData = Awaited<ReturnType<typeof getFuelProvinceOverview>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelProvinceOverview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFuelProvinceOverview>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFuelProvinceOverviewQueryResult = NonNullable<Awaited<ReturnType<typeof getFuelProvinceOverview>>>;
export type GetFuelProvinceOverviewQueryError = ErrorType<unknown>;
/**
 * @summary Get province-wise breakdown
 */
export declare function useGetFuelProvinceOverview<TData = Awaited<ReturnType<typeof getFuelProvinceOverview>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelProvinceOverview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Returns vehicle type breakdown table data
 * @summary Get vehicle type breakdown
 */
export declare const getGetFuelVehicleBreakdownUrl: () => string;
export declare const getFuelVehicleBreakdown: (options?: RequestInit) => Promise<VehicleRow[]>;
export declare const getGetFuelVehicleBreakdownQueryKey: () => readonly ["/api/fuel/vehicle-breakdown"];
export declare const getGetFuelVehicleBreakdownQueryOptions: <TData = Awaited<ReturnType<typeof getFuelVehicleBreakdown>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelVehicleBreakdown>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFuelVehicleBreakdown>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFuelVehicleBreakdownQueryResult = NonNullable<Awaited<ReturnType<typeof getFuelVehicleBreakdown>>>;
export type GetFuelVehicleBreakdownQueryError = ErrorType<unknown>;
/**
 * @summary Get vehicle type breakdown
 */
export declare function useGetFuelVehicleBreakdown<TData = Awaited<ReturnType<typeof getFuelVehicleBreakdown>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelVehicleBreakdown>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Returns province+vehicle breakdown of data received from ETO
 * @summary Get data received from ETO
 */
export declare const getGetFuelRecdFromEtoUrl: () => string;
export declare const getFuelRecdFromEto: (options?: RequestInit) => Promise<EtoRow[]>;
export declare const getGetFuelRecdFromEtoQueryKey: () => readonly ["/api/fuel/recd-from-eto"];
export declare const getGetFuelRecdFromEtoQueryOptions: <TData = Awaited<ReturnType<typeof getFuelRecdFromEto>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelRecdFromEto>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFuelRecdFromEto>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFuelRecdFromEtoQueryResult = NonNullable<Awaited<ReturnType<typeof getFuelRecdFromEto>>>;
export type GetFuelRecdFromEtoQueryError = ErrorType<unknown>;
/**
 * @summary Get data received from ETO
 */
export declare function useGetFuelRecdFromEto<TData = Awaited<ReturnType<typeof getFuelRecdFromEto>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFuelRecdFromEto>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Replace the fuel subsidy Excel with an updated version
 * @summary Upload updated Excel file
 */
export declare const getUploadFuelExcelUrl: () => string;
export declare const uploadFuelExcel: (uploadFuelExcelBody: UploadFuelExcelBody, options?: RequestInit) => Promise<UploadResult>;
export declare const getUploadFuelExcelMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadFuelExcel>>, TError, {
        data: BodyType<UploadFuelExcelBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadFuelExcel>>, TError, {
    data: BodyType<UploadFuelExcelBody>;
}, TContext>;
export type UploadFuelExcelMutationResult = NonNullable<Awaited<ReturnType<typeof uploadFuelExcel>>>;
export type UploadFuelExcelMutationBody = BodyType<UploadFuelExcelBody>;
export type UploadFuelExcelMutationError = ErrorType<unknown>;
/**
 * @summary Upload updated Excel file
 */
export declare const useUploadFuelExcel: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadFuelExcel>>, TError, {
        data: BodyType<UploadFuelExcelBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof uploadFuelExcel>>, TError, {
    data: BodyType<UploadFuelExcelBody>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map