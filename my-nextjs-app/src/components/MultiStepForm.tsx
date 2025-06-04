import { useEffect } from 'react';
import { useShadowStateStore } from '@/stores/shadowStateStore';
import { useForm } from 'react-hook-form';

const MultiStepForm = () => {
  const { register, setValue } = useForm();
  const { pendingShadowActions } = useShadowStateStore();

  useEffect(() => {
    const prefillAction = pendingShadowActions.find((a) => a.type === 'FORM_PREFILL' && a.target === 'multi-step-form');
    if (prefillAction) {
      Object.entries(prefillAction.payload).forEach(([key, value]) => {
        setValue(key, value);
      });
    }
  }, [pendingShadowActions, setValue]);

  return (
    <form>
      <input {...register('name')} />
      <input {...register('email')} />
      <button type="submit">Submit</button>
    </form>
  );
};

export default MultiStepForm;
