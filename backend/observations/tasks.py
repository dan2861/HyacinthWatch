from celery import shared_task


@shared_task
def run_qc_and_segmentation(observation_id: int):
    # TODO: load model from /models/segmentation/vX
    # TODO: perform QC + segmentation
    # TODO: update Observation row with results
    return {"observation": observation_id, "status": "processed"}
