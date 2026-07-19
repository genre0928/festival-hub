import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "축제 허브 | 국내 축제 정보 모아보기" },
    {
      name: "description",
      content: "전국 축제 정보를 지역과 기간별로 한눈에 모아보는 축제 정보 사이트",
    },
  ];
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">축제 허브 준비중...</p>
    </main>
  );
}
