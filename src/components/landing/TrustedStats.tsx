import { Users, FolderKanban, Globe } from "lucide-react";

const stats = [
  { icon: Users, label: "Developers", value: "10K+" },
  { icon: FolderKanban, label: "Projects Built", value: "3K+" },
  { icon: Globe, label: "Countries", value: "50+" },
];

const TrustedStats = () => (
  <section className="py-16">
    <div className="container mx-auto px-4">
      <div className="glass rounded-2xl py-10 px-6 flex flex-col sm:flex-row items-center justify-around gap-8">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shrink-0">
              <Icon size={22} className="text-primary-foreground" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustedStats;
