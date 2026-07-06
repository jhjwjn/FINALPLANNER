# Life Planner 배포 / Supabase Auth 설정

## 1. 배포가 필요한 이유

`npm run dev`나 `python3 -m http.server`는 내 컴퓨터에서 임시 서버를 켜는 개발 방식입니다.
컴퓨터를 끄거나 터미널을 닫으면 앱 주소도 사라집니다.

Google 로그인, 모바일 접속, PC/모바일 데이터 공유를 하려면 Vercel 같은 곳에 배포해서 고정 HTTPS 주소를 만드는 것이 좋습니다.

## 2. Vercel 배포

가장 쉬운 방법은 Vercel Dashboard에서 GitHub 저장소를 연결하는 방식입니다.

1. 이 프로젝트 폴더를 GitHub repo로 올립니다.
2. Vercel Dashboard로 이동합니다.
3. New Project를 누릅니다.
4. GitHub repo를 선택합니다.
5. Framework Preset은 `Other`를 선택합니다.
6. Build Command는 비워둡니다.
7. Output Directory도 비워둡니다.
8. Deploy를 누릅니다.

현재 앱은 빌드가 필요 없는 정적 웹앱입니다.
Vercel은 프레임워크가 없으면 파일을 그대로 배포할 수 있습니다.

## 3. Supabase SQL 실행

Supabase Dashboard > SQL Editor에서 `supabase-schema.sql` 전체를 실행합니다.

이 SQL은 `planner_records` 테이블을 만들고, 로그인한 사용자 본인의 데이터만 읽고 쓸 수 있게 RLS 정책을 적용합니다.

## 4. Supabase Google Auth 활성화

현재 `Unsupported provider: provider is not enabled` 오류는 Google Provider가 Supabase에서 아직 활성화되지 않았다는 뜻입니다.

설정 순서:

1. Supabase Dashboard로 이동합니다.
2. Authentication > Providers로 이동합니다.
3. Google을 선택합니다.
4. Enable Google provider를 켭니다.
5. 이 화면에 표시되는 Callback URL을 복사합니다.
   - 보통 `https://<project-ref>.supabase.co/auth/v1/callback` 형태입니다.
6. Google Cloud Console로 이동합니다.
7. APIs & Services > OAuth consent screen을 설정합니다.
8. APIs & Services > Credentials로 이동합니다.
9. OAuth Client ID를 생성합니다.
10. Application type은 `Web application`으로 선택합니다.
11. Authorized JavaScript origins에 Vercel 주소를 추가합니다.
    - 예: `https://your-planner.vercel.app`
    - 로컬 테스트도 유지하려면 `http://127.0.0.1:5180`도 추가합니다.
12. Authorized redirect URIs에 Supabase Callback URL을 추가합니다.
13. 생성된 Google Client ID / Client Secret을 Supabase Google Provider 설정에 붙여넣습니다.
14. Supabase Authentication > URL Configuration으로 이동합니다.
15. Site URL에 Vercel 주소를 넣습니다.
16. Redirect URLs에 Vercel 주소와 로컬 주소를 넣습니다.

## 5. 배포 주소를 코드에 반영할 필요가 있나?

현재 코드는 로그인 요청 시 자동으로 현재 앱 주소를 redirect URL로 사용합니다.

```js
redirectTo: window.location.origin + window.location.pathname
```

따라서 Vercel 주소가 정해지면 Supabase/Google 설정에 그 주소만 등록하면 됩니다.

## 6. 진짜 Supabase에 올라갔는지 확인

앱 설정 화면에서 `연결 확인`을 누르면 `원격 n건`이 표시됩니다.

Supabase SQL Editor에서도 확인할 수 있습니다.

```sql
select owner_id, store, id, updated_at
from planner_records
order by updated_at desc;
```

로그인 후 `Supabase로 올리기`를 누르면 현재 로컬 IndexedDB 데이터가 로그인 사용자 ID 기준으로 올라갑니다.
