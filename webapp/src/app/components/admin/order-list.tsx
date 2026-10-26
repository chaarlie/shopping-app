'use client';
import { useState } from 'react';
import { adminOrdersSchema, orderStatusSchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { dateTime, money } from '@/lib/format';
import { Feedback, Pagination } from '../feedback';
const labels = {
  paid: 'Paid',
  pending_payment: 'Awaiting payment',
  cancelled: 'Cancelled',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};
export default function OrderList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('paid');
  const state = useResource(
    `/admin/orders?page=${page}&pageSize=14${status ? `&status=${status}` : ''}`,
    adminOrdersSchema,
  );
  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <p>
          Purchased products and the guest details supplied at checkout. Times
          use your device’s time zone; amounts are in USD.
        </p>
      </div>
      <div className="catalog-toolbar">
        <label>
          Payment status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All orders</option>
            {orderStatusSchema.options.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-grey" onClick={state.reload}>
          Refresh orders
        </button>
      </div>
      {state.loading ? (
        <Feedback message="Loading orders…" />
      ) : state.error ? (
        <Feedback error message={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            {!state.data.items.length ? (
              <Feedback message="No orders match this payment status." />
            ) : (
              <div className="table-scroll">
                <table>
                  <caption className="sr">
                    Orders, checkout contact details, products, placement time
                    and total amount
                  </caption>
                  <thead>
                    <tr>
                      <th>Order / status</th>
                      <th>Customer</th>
                      <th>Placed at</th>
                      <th>Products</th>
                      <th>Order total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((order) => (
                      <tr key={order.reference}>
                        <td>
                          <strong>{order.reference}</strong>
                          <p>{labels[order.status]}</p>
                        </td>
                        <td>
                          <strong>{order.name}</strong>
                          <p>{order.email}</p>
                          <span className="muted">Guest checkout</span>
                        </td>
                        <td>
                          <time dateTime={order.createdAt}>
                            {dateTime(order.createdAt)}
                          </time>
                        </td>
                        <td>
                          <ul>
                            {order.items.map((item) => (
                              <li key={item.sku}>
                                <strong>{item.name}</strong>
                                <p>
                                  {item.sku} · {item.quantity} ×{' '}
                                  {money(item.unitPriceCents)} ={' '}
                                  {money(item.lineTotalCents)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          <strong>{money(order.totalCents)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              pageSize={14}
              total={state.data.total}
              onPage={setPage}
            />
          </>
        )
      )}
    </>
  );
}
