import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase'; // Adjusted path to use alias

const CronStatus = () => {
  const { data, error } = useQuery({
    queryKey: ['cron_jobs'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from('cron.job_run_details').select('*').limit(10);
      if (queryError) {
        throw queryError;
      }
      return data;
    },
  });

  if (error) return <div>Error loading cron status: {error.message}</div>;
  return (
    <div>
      <h2>Cron Job Status</h2>
      <ul>
        {data?.map((job: { id: string; job_name: string; status: string; run_at: string }) => ( // Defined a more specific type for job
          <li key={job.id}>
            {job.job_name}: {job.status} at {job.run_at}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CronStatus;
