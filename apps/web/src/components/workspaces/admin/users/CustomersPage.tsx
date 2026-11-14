import { useEffect, useRef, useState } from "react";
import {
  Button,
  ActivityList,
  Avatar,
  Drawer,
  Icon,
  PageHeader,
  Panel,
  Pagination,
  SearchField,
  StatCard,
  useNotifications,
} from "@event-management/ui";
import { usePagination } from "../../../../lib/pagination/use-pagination";
import {
  getAdminUsers,
  type AdminUser,
  type DirectoryStats,
} from "../../../../lib/data/users/users";

type LoadState = "loading" | "ready" | "error";

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CustomersPage() {
  const { notifyError } = useNotifications();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadRevision, setLoadRevision] = useState(0);
  const [stats, setStats] = useState<DirectoryStats>({
    customerTotal: 0,
    customerJoined: 0,
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<AdminUser | null>(
    null,
  );

  const search = customerQuery;
  const scope = JSON.stringify([search.trim().toLowerCase()]);
  const pagination = usePagination(scope);
  const requestKey = JSON.stringify([scope, pagination.cursor]);
  const currentScope = useRef(requestKey);
  currentScope.current = requestKey;
  useEffect(() => {
    let active = true;
    setLoadState("loading");
    getAdminUsers(search, pagination.cursor ?? undefined)
      .then(({ customers, stats, nextCursor }) => {
        if (!active || currentScope.current !== requestKey) return;
        setCustomers(customers);
        setStats(stats);
        setNextCursor(nextCursor);
        setLoadedKey(requestKey);
        setLoadState("ready");
      })
      .catch(() => {
        if (active && currentScope.current === requestKey) {
          setLoadState("error");
          notifyError("Unable to load customers.");
        }
      });
    return () => {
      active = false;
    };
  }, [search, requestKey, pagination.cursor, notifyError, loadRevision]);

  const pageReady = loadState === "ready" && loadedKey === requestKey;
  const filteredCustomers = customers;

  if (loadState === "error") {
    return (
      <div className="content-stack">
        <PageHeader title="Customers" description="View customer profiles." />
        <div className="empty-state">
          <Icon name="alert" size={28} />
          <strong>Could not load users</strong>
          <span>Please check your connection and try again.</span>
          <Button
            variant="secondary"
            onClick={() => {
              setLoadState("loading");
              setLoadRevision((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-stack">
      <PageHeader title="Customers" description="View customer profiles." />
      {!pageReady && <p role="status">Loading customers…</p>}
      <div className="stats-grid three">
        <StatCard
          label="Total customers"
          value={String(stats.customerTotal)}
          detail="In the directory"
        />
        <StatCard
          label="Joined this month"
          value={String(stats.customerJoined)}
          detail="New this month"
        />
        <StatCard label="Active inquiries" value="—" detail="Coming soon" />
      </div>
      <Panel className="customer-admin-panel">
        <div className="table-tools">
          <SearchField
            value={customerQuery}
            onChange={(event) =>
              setCustomerQuery(event.target.value.slice(0, 200))
            }
            placeholder="Search customer name or email"
          />
        </div>
        <div className="customer-admin-table">
          <div className="customer-admin-row header">
            <span>Customer</span>
            <span>Email</span>
            <span></span>
          </div>
          {(pageReady ? filteredCustomers : []).map((customer) => (
            <Button
              variant="plain"
              className="customer-admin-row"
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
            >
              <span>
                <span className="directory-avatar" aria-hidden="true">
                  <Avatar initials={initials(customer.displayName)} />
                </span>
                <span>
                  <strong>{customer.displayName ?? customer.email}</strong>
                  <small>{customer.email}</small>
                </span>
              </span>
              <span>{customer.email}</span>
              <Icon name="chevron" size={15} />
            </Button>
          ))}
          {pageReady && filteredCustomers.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <strong>No matching customers</strong>
              <span>Try a different search term.</span>
            </div>
          )}
        </div>
        <Pagination
          page={pagination.page}
          hasNextPage={pageReady && !!nextCursor}
          onPrevious={pagination.previous}
          onNext={() => nextCursor && pagination.next(nextCursor)}
          pending={!pageReady}
        />
      </Panel>
      {selectedCustomer && (
        <Drawer
          title={selectedCustomer.displayName ?? selectedCustomer.email}
          onClose={() => setSelectedCustomer(null)}
        >
          <p>Customer</p>
          <div className="detail-grid">
            <div>
              <span>Email</span>
              <strong>{selectedCustomer.email}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>—</strong>
            </div>
            <div>
              <span>Member since</span>
              <strong>
                {new Date(selectedCustomer.createdAt).toLocaleDateString(
                  "en-PH",
                  { year: "numeric", month: "long", day: "numeric" },
                )}
              </strong>
            </div>
          </div>
          <div className="subheading">Recent activity</div>
          <ActivityList
            items={[
              {
                title: "Account created",
                detail: new Date(selectedCustomer.createdAt).toLocaleDateString(
                  "en-PH",
                  { year: "numeric", month: "long", day: "numeric" },
                ),
              },
            ]}
          />
        </Drawer>
      )}
    </div>
  );
}
