import { ReactNode } from "react";
import Lottie from "lottie-react";
import noDataAnimation from "../assets/nodata.json";

type Props = {
  data?: any[] | null;
  loading?: boolean;
  message?: string;
  children: ReactNode;
};

export default function DataState({
  data,
  loading = false,
  message = "No data found",
  children,
}: Props) {

  // 1️⃣ Loading → KEEP DOM STABLE
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // 2️⃣ Empty data → show animation
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh]">
        <div className="w-[260px]">
          <Lottie animationData={noDataAnimation} loop autoplay />
        </div>
        <p className="mt-2 text-gray-500 text-sm">{message}</p>
      </div>
    );
  }

  // 3️⃣ Data exists → show UI
  return <>{children}</>;
}
