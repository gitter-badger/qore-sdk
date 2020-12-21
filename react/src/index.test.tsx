import { renderHook, act } from "@testing-library/react-hooks";
import createQoreContext from ".";
import { QoreClient } from "@qore/client";
import nock from "nock";
import axios from "axios";

const createNewQoreContext = () => {
  const qoreClient = new QoreClient<{
    allTasks: {
      read: { id: string; title: string };
      write: { title: string };
      params: { slug?: string };
    };
  }>({
    organisationId: "FAKE_ORG",
    projectId: "FAKE_PROJECT"
  });

  qoreClient.init({
    version: "v1",
    views: [
      {
        id: "allTasks",
        name: "All tasks",
        tableId: "tasks",
        fields: [
          { type: "text", name: "id", id: "id", deletionProtection: false },
          {
            type: "text",
            name: "title",
            id: "title",
            deletionProtection: false
          }
        ]
      }
    ]
  });

  return createQoreContext(qoreClient);
};

describe("useListRow", () => {
  it("should fetch data successfully", async () => {
    nock("http://localhost:8080")
      .get("/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows")
      .reply(200, {
        nodes: [
          {
            id: "25b0cccf-4851-43e2-80c7-f68e7883dbd6",
            user: {
              id: "9275e876-fd95-45a0-ad67-b947a1296c32",
              displayField: "rrmdn@pm.me"
            },
            name: "Meeting 1",
            done: true
          }
        ],
        totalCount: "1"
      });

    const qoreContext = createNewQoreContext();

    const { result, waitForNextUpdate } = renderHook(() =>
      qoreContext.views.allTasks.useListRow()
    );

    expect(result.current.status).toEqual("loading");
    expect(result.current.data).toEqual([]);

    await waitForNextUpdate();

    expect(result.current.status).toEqual("success");
    expect(result.current.data).toEqual([
      {
        id: "25b0cccf-4851-43e2-80c7-f68e7883dbd6",
        user: {
          id: "9275e876-fd95-45a0-ad67-b947a1296c32",
          displayField: "rrmdn@pm.me"
        },
        name: "Meeting 1",
        done: true
      }
    ]);
  });

  it("should get error message if network failed", async () => {
    nock("http://localhost:8080")
      .get("/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows")
      .reply(500, undefined);

    const qoreContext = createNewQoreContext();

    const { result, waitForNextUpdate } = renderHook(() =>
      qoreContext.views.allTasks.useListRow()
    );

    expect(result.current.status).toEqual("loading");
    expect(result.current.error).toEqual(null);

    await waitForNextUpdate();
    expect(result.current.status).toEqual("error");
    expect(result.current.error?.message).toEqual(
      "Request failed with status code 500"
    );
  });
});

describe("useGetRow", () => {
  it("should fetch data successfully", async () => {
    nock("http://localhost:8080")
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, {
        id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
        description: null,
        done: false,
        name: "New task",
        user: null
      });

    const qoreContext = createNewQoreContext();

    const { result, waitForNextUpdate } = renderHook(() =>
      qoreContext.views.allTasks.useGetRow(
        "beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
    );

    expect(result.current.status).toEqual("loading");
    expect(result.current.data).toEqual(null);

    await waitForNextUpdate();

    expect(result.current.status).toEqual("success");
    expect(result.current.data).toEqual({
      id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
      description: null,
      done: false,
      name: "New task",
      user: null
    });
  });

  it("should get error message if network failed", async () => {
    nock("http://localhost:8080")
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(500, undefined);

    const qoreContext = createNewQoreContext();

    const { result, waitForNextUpdate } = renderHook(() =>
      qoreContext.views.allTasks.useGetRow(
        "beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
    );

    expect(result.current.status).toEqual("loading");
    expect(result.current.error).toEqual(null);

    await waitForNextUpdate();
    expect(result.current.status).toEqual("error");
    expect(result.current.error?.message).toEqual(
      "Request failed with status code 500"
    );
  });
});

describe("useInsertRow", () => {
  it("should insert new row, write, and read from cache", async () => {
    nock("http://localhost:8080")
      .post("/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows")
      .reply(200, {
        id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      })
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, {
        id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
        title: "New task"
      })
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, {
        id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
        title: "New task"
      });

    const qoreContext = createNewQoreContext();

    const { result: insertResult } = renderHook(() =>
      qoreContext.views.allTasks.useInsertRow()
    );

    const { result: getResult } = renderHook(() =>
      qoreContext.views.allTasks.useGetRow(
        "beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
    );

    expect(insertResult.current.status).toEqual("idle");

    await act(async () => {
      const newTask = await insertResult.current.insertRow({
        title: "New task"
      });
      expect(newTask).toHaveProperty("title", "New task");
      expect(getResult.current.data).toEqual(newTask);
    });

    expect(insertResult.current.status).toEqual("success");
  });

  it("should get error message if network failed", async () => {
    nock("http://localhost:8080")
      .post("/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows")
      .reply(500, undefined);

    const qoreContext = createNewQoreContext();
    const { result } = renderHook(() =>
      qoreContext.views.allTasks.useInsertRow()
    );

    expect(result.current.status).toEqual("idle");
    await act(async () => {
      await result.current.insertRow({ title: "New Task" });
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.error?.message).toEqual(
      "Request failed with status code 500"
    );
  });
});

describe("useUpdateRow", () => {
  it("should update row", async () => {
    nock("http://localhost:8080")
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, {
        id: "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
        title: "Old task"
      })
      .patch(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, { ok: true });

    const qoreContext = createNewQoreContext();

    const { result } = renderHook(() =>
      qoreContext.views.allTasks.useUpdateRow()
    );

    expect(result.current.status).toEqual("idle");
    await act(async () => {
      const updatedTask = await result.current.updateRow(
        "beba4104-44ee-46b2-9ddc-e6bfd0a1570f",
        { title: "Old task" }
      );
      expect(updatedTask).toHaveProperty("title", "Old task");
    });
    expect(result.current.status).toEqual("success");
  });

  it("should get error message if network failed", async () => {
    nock("http://localhost:8080")
      .get(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/views/allTasks/v2rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(500, undefined)
      .patch(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(500, undefined);

    const qoreContext = createNewQoreContext();
    const { result } = renderHook(() =>
      qoreContext.views.allTasks.useUpdateRow()
    );

    expect(result.current.status).toEqual("idle");
    await act(async () => {
      await result.current.updateRow("beba4104-44ee-46b2-9ddc-e6bfd0a1570f", {
        title: "Old Task"
      });
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.error?.message).toEqual(
      "Request failed with status code 500"
    );
  });
});

describe("useDeleteRow", () => {
  it("should delete row", async () => {
    nock("http://localhost:8080")
      .delete(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(200, { ok: true });

    const qoreContext = createNewQoreContext();

    const { result } = renderHook(() =>
      qoreContext.views.allTasks.useDeleteRow()
    );

    expect(result.current.status).toEqual("idle");
    await act(async () => {
      const isSuccess = await result.current.deleteRow(
        "beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      );
      expect(isSuccess).toEqual(true);
    });
    expect(result.current.status).toEqual("success");
  });

  it("should get error message if network failed", async () => {
    nock("http://localhost:8080")
      .delete(
        "/orgs/FAKE_ORG/projects/FAKE_PROJECT/tables/tasks/rows/beba4104-44ee-46b2-9ddc-e6bfd0a1570f"
      )
      .reply(500);

    const qoreContext = createNewQoreContext();
    const { result } = renderHook(() =>
      qoreContext.views.allTasks.useDeleteRow()
    );

    expect(result.current.status).toEqual("idle");
    await act(async () => {
      await result.current.deleteRow("beba4104-44ee-46b2-9ddc-e6bfd0a1570f");
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.error?.message).toEqual(
      "Request failed with status code 500"
    );
  });
});
