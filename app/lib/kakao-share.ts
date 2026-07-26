// 카카오톡 "친구에게 보내기" 공유 - 카카오 로그인(REST API)과는 별개로 카카오 JS SDK의
// Kakao.Share.sendDefault()를 쓴다. 로그인 여부와 무관하게 누구나 쓸 수 있고, 누르면
// 카카오톡 친구/채팅방 선택 화면이 뜬다.
//
// 필요: VITE_KAKAO_JS_KEY (카카오 디벨로퍼스 > 앱 키 > JavaScript 키).
// 그리고 이 사이트 도메인이 해당 앱의 "Web 플랫폼"에 등록돼 있어야 동작한다(안 하면
// 카카오 SDK가 도메인 불일치로 조용히 실패함).

const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadKakaoSdk(): Promise<void> {
  const jsKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!jsKey) {
    return Promise.reject(new Error("카카오톡 공유가 아직 설정되지 않았어요."));
  }
  if (window.Kakao?.isInitialized()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${KAKAO_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (!window.Kakao?.isInitialized()) window.Kakao?.init(jsKey);
        resolve();
      });
      existing.addEventListener("error", () => reject(new Error("카카오 SDK 로드에 실패했어요.")));
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.onload = () => {
      window.Kakao?.init(jsKey);
      resolve();
    };
    script.onerror = () => reject(new Error("카카오 SDK 로드에 실패했어요."));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * 축제명/행사지역/네이버 검색 링크로 된 템플릿을 카카오톡 공유 시트로 띄운다.
 * 카드(및 텍스트 안의 링크) 자체는 shareUrl(우리 사이트의 ?festival= 링크)로 연결해서,
 * 눌렀을 때 축제 상세(모달)가 바로 열리게 한다. naverUrl은 텍스트 안내용으로만 쓰인다.
 * 포스터 이미지(imageUrl)가 있으면 이미지가 상단에 붙는 카드형(feed) 템플릿을,
 * 없으면 기존 텍스트 템플릿을 쓴다(카카오 feed 템플릿은 imageUrl이 필수).
 */
export async function shareFestivalToKakao(params: {
  title: string;
  region: string;
  naverUrl: string;
  shareUrl: string;
  imageUrl?: string | null;
}): Promise<void> {
  await loadKakaoSdk();
  if (!window.Kakao) throw new Error("카카오 SDK를 불러오지 못했어요.");

  const link = { mobileWebUrl: params.shareUrl, webUrl: params.shareUrl };

  if (params.imageUrl) {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: params.title,
        description: `행사지역 : ${params.region}\n네이버 검색 : ${params.naverUrl}`,
        imageUrl: params.imageUrl,
        link,
      },
      buttons: [{ title: "축제 정보 보기", link }],
    });
    return;
  }

  const text = `행사명 : ${params.title}\n행사지역 : ${params.region}\n네이버 검색 : ${params.naverUrl}`;
  window.Kakao.Share.sendDefault({ objectType: "text", text, link });
}
