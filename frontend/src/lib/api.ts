const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000"; 
interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

interface SignupResponse {
  message?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface ProtectedResponse {
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
  message?: string;
}

// ----------------- AUTH FUNCTIONS -----------------

async function signup(email: string, password: string): Promise<SignupResponse> {
  console.log("Attempting signup for:", email);

  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  console.log("Signup response status:", res.status);

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Signup failed with status ${res.status}`);
  }

  if (!res.ok) {
    const errorMessage =
      data.error || data.message || `Signup failed with status ${res.status}`;
    console.error("Signup error details:", data);
    throw new Error(errorMessage);
  }

  console.log("Signup success:", data);
  return data;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  console.log("Attempting login for:", email);

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  console.log("Login response status:", res.status);

  let data: any;
  try {
    data = await res.json(); // ✅ Parse once
  } catch {
    throw new Error(`Login failed with status ${res.status}`);
  }

  if (!res.ok) {
    const errorMessage =
      data.error || data.message || `Login failed with status ${res.status}`;
    console.error("Login error details:", data);
    throw new Error(errorMessage);
  }

  console.log("Login success. Token received:", !!data.access_token);
  return data;
}

async function getProtected(accessToken: string): Promise<ProtectedResponse> {
  console.log("🔍 Making protected request...");
  console.log("🔑 Token preview:", accessToken.substring(0, 20) + "...");

  const res = await fetch(`${BASE_URL}/api/auth/protected`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  console.log("📥 Response status:", res.status);

  let data: any;
  let isJson = false;
  try {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
      isJson = true;
    } else {
      const text = await res.text();
      data = { message: text };
    }
  } catch (e) {
    console.error("❌ Error parsing protected response:", e);
    throw new Error(`Protected request failed with status ${res.status}`);
  }

  if (!res.ok) {
    const errorMessage =
      (isJson && (data.error || data.message || data.detail)) ||
      data.message ||
      `Protected request failed with status ${res.status}`;
    console.error("❌ API Error details:", data);
    throw new Error(errorMessage);
  }

  console.log("✅ Protected route success:", data);
  return data;
}

// ----------------- DEBUG HELPER -----------------

async function testProtectedWithDifferentHeaders(accessToken: string) {
  const testCases = [
    { name: "Bearer Token", headers: { "Authorization": `Bearer ${accessToken}` }},
    { name: "Direct Token", headers: { "Authorization": accessToken }},
    { name: "X-Access-Token", headers: { "x-access-token": accessToken }},
    { name: "X-Auth-Token", headers: { "x-auth-token": accessToken }},
    { name: "Token Header", headers: { "token": accessToken }},
  ];

  console.log("🧪 Testing different header formats...");

  for (const testCase of testCases) {
    try {
      console.log(`\n🔬 Testing: ${testCase.name}`);

      const res = await fetch(`${BASE_URL}/api/auth/protected`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...testCase.headers,
        },
      });

      console.log(`📊 ${testCase.name} - Status: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ ${testCase.name} - SUCCESS!`, data);
        return { success: true, format: testCase.name, data };
      } else {
        const errorText = await res.text();
        console.log(`❌ ${testCase.name} - Failed:`, errorText);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - Error:`, error);
    }
  }

  return { success: false };
}

// ----------------- EXPORT -----------------

const api = {
  signup,
  login,
  getProtected,
  testProtectedWithDifferentHeaders, // for debugging
};

export default api;