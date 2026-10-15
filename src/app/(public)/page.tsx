export default function Page() {
  return (
    <div className="p-4">
      <h1>Tamera&apos;s Cakes & Bakery</h1>
      <p>Order system ready. Please log in to the dashboard.</p>
      <div className="mt-4">
        <button className="rounded-full bg-strawberry px-6 py-3 text-white hover:bg-strawberry-deep">
          Start Ordering Cakes
        </button>
        <button className="rounded-full bg-caramel px-6 py-3 text-white hover:opacity-90">
          Order Pastries
        </button>
      </div>
    </div>
  )
}
