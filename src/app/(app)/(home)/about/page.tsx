import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Page() {
  return (
    <div className="px-4 lg:px-12 py-8 flex flex-col gap-12 items-center">
      {/* Intro Section */}
      <section className="flex flex-col gap-4 max-w-prose text-center">
        <h1 className="text-3xl font-semibold">What we do</h1>
        <p className="text-muted-foreground">
          Abandoned Hobby is a safe, judgment-free space where neurodivergent
          (ADHD, ASD, and others!) people can buy, sell, or trade hobby supplies
          they&apos;ve outgrown or left behind. Whether you&apos;re passing on
          an old passion or picking up a new one, this is the place to do it —
          with understanding and without pressure.
        </p>
      </section>

      {/* How It Works Section */}
      <section className="w-full max-w-6xl flex flex-col items-center gap-8">
        <h2 className="text-3xl font-semibold text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Card>
            <CardHeader>
              <CardTitle>1. List a Hobby</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Snap a photo, write a quick description, and post your hobby item
              for others to explore. It’s easy and free.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Connect & Trade</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Chat with other users to buy, sell, or swap hobby items. We make
              it simple to connect with like-minded folks.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Keep Exploring</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Discover new hobbies or revisit old ones — guilt-free. Come back
              anytime and share your creative journey.
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default Page;
