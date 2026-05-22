const rawApiBaseUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

const API_BASE_URL = rawApiBaseUrl.endsWith("/api")
  ? rawApiBaseUrl
  : `${rawApiBaseUrl}/api`;

const getToken = () => localStorage.getItem("token");
const uploadedFiles = new Map();

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error?.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const apiRequest = request;

function getLocalUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.payload = {
      filters: [],
      op: "select",
    };
  }

  select(columns = "*") {
    this.payload.columns = columns;
    return this;
  }

  eq(field, value) {
    this.payload.filters.push({ field, value });
    return this;
  }

  or(expression) {
    this.payload.or = expression;
    return this;
  }

  order(field, options = {}) {
    this.payload.order = {
      field,
      ascending: Boolean(options.ascending),
    };
    return this;
  }

  limit(value) {
    this.payload.limit = value;
    return this;
  }

  insert(values) {
    this.payload.op = "insert";
    this.payload.values = values;
    return this;
  }

  update(values) {
    this.payload.op = "update";
    this.payload.values = values;
    return this;
  }

  upsert(values) {
    this.payload.op = "upsert";
    this.payload.values = values;
    return this;
  }

  delete() {
    this.payload.op = "delete";
    return this;
  }

  single() {
    this.payload.single = true;
    return this.execute();
  }

  maybeSingle() {
    this.payload.single = true;
    this.payload.maybeSingle = true;
    return this.execute();
  }

  async execute() {
    try {
      const payload = await request(`/data/${this.table}`, {
        method: "POST",
        body: JSON.stringify(this.payload),
      });

      return {
        data: payload.data ?? null,
        error: payload.error ?? null,
      };
    } catch (error) {
      return {
        data: null,
        error,
      };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export const db = {
  auth: {
    async loginWithPassword({ email, password }) {
      try {
        const payload = await request("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        const session = { access_token: payload.token };
        localStorage.setItem("token", payload.token);
        localStorage.setItem("user", JSON.stringify(payload.user));

        return {
          data: { user: payload.user, session },
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },

    async register(values) {
      try {
        const payload = await request("/auth/register", {
          method: "POST",
          body: JSON.stringify(values),
        });

        const session = { access_token: payload.token };
        localStorage.setItem("token", payload.token);
        localStorage.setItem("user", JSON.stringify(payload.user));

        return {
          data: { user: payload.user, session },
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },

    async currentUser() {
      try {
        if (!getToken()) {
          return { data: { user: getLocalUser() }, error: null };
        }

        const payload = await request("/auth/profile");
        const user = payload.user || getLocalUser();
        if (user) localStorage.setItem("user", JSON.stringify(user));

        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: getLocalUser() }, error: null };
      }
    },

    async getSession() {
      const token = getToken();
      return {
        data: { session: token ? { access_token: token } : null },
        error: null,
      };
    },

    onSessionChange() {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },

    async resetPasswordForEmail(email, options = {}) {
      try {
        const data = await request("/auth/password-reset/request", {
          method: "POST",
          body: JSON.stringify({
            email,
            redirectTo: options.redirectTo,
          }),
        });

        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async updateUser(values) {
      try {
        const data = await request("/auth/password", {
          method: "PATCH",
          body: JSON.stringify(values),
        });

        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async resetPasswordWithToken({ token, password }) {
      try {
        const data = await request("/auth/password-reset/confirm", {
          method: "PATCH",
          body: JSON.stringify({ token, password }),
        });

        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async signOut() {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return { error: null };
    },
  },

  from(table) {
    return new QueryBuilder(table);
  },

  storage: {
    bucket() {
      return {
        async upload(path, file) {
          try {
            const formData = new FormData();
            formData.append("file", file, path);
            const data = await request("/uploads", {
              method: "POST",
              body: formData,
            });
            uploadedFiles.set(path, data.publicUrl);

            return { data, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },

        getPublicUrl(path) {
          return {
            data: {
              publicUrl: `${API_BASE_URL.replace(/\/api$/, "")}${
                uploadedFiles.get(path) || (path?.startsWith("/uploads/") ? path : `/uploads/${path}`)
              }`,
            },
          };
        },
      };
    },
  },
};
